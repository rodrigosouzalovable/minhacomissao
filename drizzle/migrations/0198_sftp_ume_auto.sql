CREATE OR REPLACE FUNCTION public.sftp_ume_auto_autorizada(p_token text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
 SELECT length(coalesce(p_token,'')) > 32 AND EXISTS (
  SELECT 1 FROM cron.job WHERE jobname LIKE 'sftp-ume-auto-%' AND active
  AND substring(command FROM 'Bearer ([A-Za-z0-9_.-]+)') = p_token);
$$;

CREATE OR REPLACE FUNCTION public.sftp_ume_pode() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT coalesce(auth.role(),'') = 'service_role' OR public.has_role(auth.uid(), 'admin'::public.app_role);
$$;

CREATE OR REPLACE FUNCTION public.ume_carteira_finalizar(p_carteira text, p_lote date)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_n integer := 0;
BEGIN
  IF NOT public.sftp_ume_pode() THEN RAISE EXCEPTION 'Apenas administradores.' USING ERRCODE = '42501'; END IF;
  IF EXISTS (SELECT 1 FROM ume_carteira_parcelas WHERE carteira = p_carteira AND data_lote > p_lote) THEN RETURN 0; END IF;
  DELETE FROM ume_carteira_parcelas WHERE carteira = p_carteira AND data_lote < p_lote;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END $function$;

CREATE OR REPLACE FUNCTION public.ume_carteira_gravar(p_carteira text, p_lote date, p_clientes jsonb, p_parcelas jsonb)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_n integer := 0;
BEGIN
  IF NOT public.sftp_ume_pode() THEN RAISE EXCEPTION 'Apenas administradores.' USING ERRCODE = '42501'; END IF;
  INSERT INTO ume_carteira_clientes(cpf, borrower_id, nome, carteira, data_lote, atualizado_em)
  SELECT public.cpf_normalize(c->>'cpf'), c->>'borrower_id', c->>'nome', p_carteira, p_lote, now()
  FROM jsonb_array_elements(coalesce(p_clientes, '[]'::jsonb)) c
  WHERE coalesce(c->>'cpf','') <> '' AND coalesce(c->>'borrower_id','') <> ''
  ON CONFLICT (cpf) DO UPDATE SET borrower_id = EXCLUDED.borrower_id, nome = EXCLUDED.nome,
    carteira = EXCLUDED.carteira, data_lote = EXCLUDED.data_lote, atualizado_em = now()
  WHERE ume_carteira_clientes.data_lote <= EXCLUDED.data_lote;

  INSERT INTO ume_carteira_parcelas(installment_id, cpf, borrower_id, contrato, vencimento, valor, carteira, data_lote)
  SELECT p->>'installment_id', public.cpf_normalize(p->>'cpf'), p->>'borrower_id', p->>'contrato',
    (p->>'vencimento')::date, (p->>'valor')::numeric, p_carteira, p_lote
  FROM jsonb_array_elements(coalesce(p_parcelas, '[]'::jsonb)) p
  WHERE coalesce(p->>'installment_id','') <> ''
  ON CONFLICT (installment_id) DO UPDATE SET cpf = EXCLUDED.cpf, borrower_id = EXCLUDED.borrower_id,
    contrato = EXCLUDED.contrato, vencimento = EXCLUDED.vencimento, valor = EXCLUDED.valor,
    carteira = EXCLUDED.carteira, data_lote = EXCLUDED.data_lote
  WHERE ume_carteira_parcelas.data_lote <= EXCLUDED.data_lote;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END $function$;

CREATE OR REPLACE FUNCTION public.sftp_ume_registrar(p_nome text, p_origem text, p_data_lote date, p_assinatura text, p_total_linhas integer, p_baixas jsonb)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_id uuid; v_casadas integer;
BEGIN
  IF NOT public.sftp_ume_pode() THEN RAISE EXCEPTION 'Apenas administradores.' USING ERRCODE = '42501'; END IF;
  IF EXISTS (SELECT 1 FROM sftp_ume_arquivos WHERE assinatura = p_assinatura) THEN
    RAISE EXCEPTION 'Este arquivo já foi importado.' USING ERRCODE = '23505';
  END IF;
  INSERT INTO sftp_ume_arquivos(nome_arquivo, origem, data_lote, assinatura, total_linhas, total_baixas, criado_por)
  VALUES (p_nome, p_origem, p_data_lote, p_assinatura, p_total_linhas, jsonb_array_length(p_baixas), auth.uid())
  RETURNING id INTO v_id;

  INSERT INTO sftp_ume_baixas(arquivo_id, tipo, cpf, contrato, parcela_ref, vencimento, valor, data_pagamento, valor_pago,
    pagamento_id, acordo_id, status)
  SELECT v_id, b->>'tipo', public.cpf_normalize(b->>'cpf'), b->>'contrato', b->>'parcela_ref',
    (b->>'vencimento')::date, (b->>'valor')::numeric, (b->>'data_pagamento')::date, (b->>'valor_pago')::numeric,
    m.pid, m.aid,
    CASE WHEN m.pid IS NULL THEN 'sem_acordo' WHEN m.st = 'pago' THEN 'ja_pago' ELSE 'casado' END
  FROM jsonb_array_elements(p_baixas) b
  LEFT JOIN LATERAL (
    SELECT p.id pid, a.id aid, p.status st
    FROM acordos a JOIN pagamentos p ON p.acordo_id = a.id
    WHERE public.cpf_normalize(a.cliente_cpf) = public.cpf_normalize(b->>'cpf')
      AND a.status = 'ativo' AND a.empresa IN ('mundo_da_moda','odres_cred','ume_novo_mundo')
      AND abs(p.valor_parcela - coalesce((b->>'valor_pago')::numeric, (b->>'valor')::numeric)) <= 1
      AND p.data_prevista BETWEEN coalesce((b->>'vencimento')::date, (b->>'data_pagamento')::date) - 5
                              AND coalesce((b->>'vencimento')::date, (b->>'data_pagamento')::date) + 5
    ORDER BY (p.status = 'pendente') DESC, abs(p.data_prevista - coalesce((b->>'vencimento')::date, (b->>'data_pagamento')::date))
    LIMIT 1
  ) m ON true;

  SELECT count(*) INTO v_casadas FROM sftp_ume_baixas WHERE arquivo_id = v_id AND status = 'casado';
  UPDATE sftp_ume_arquivos SET casadas = v_casadas WHERE id = v_id;
  RETURN v_id;
END $function$;