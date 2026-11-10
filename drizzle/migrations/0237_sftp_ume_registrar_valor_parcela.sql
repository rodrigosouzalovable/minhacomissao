CREATE OR REPLACE FUNCTION public.sftp_ume_registrar(p_nome text, p_origem text, p_data_lote date, p_assinatura text, p_total_linhas integer, p_baixas jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_id uuid; v_casadas integer;
BEGIN
  IF NOT public.sftp_ume_pode() THEN RAISE EXCEPTION 'Apenas administradores.' USING ERRCODE = '42501'; END IF;
  IF EXISTS (SELECT 1 FROM sftp_ume_arquivos WHERE assinatura = p_assinatura) THEN
    RAISE EXCEPTION 'Este arquivo já foi importado.' USING ERRCODE = '23505';
  END IF;
  INSERT INTO sftp_ume_arquivos(nome_arquivo, origem, data_lote, assinatura, total_linhas, total_baixas, criado_por)
  VALUES (p_nome, p_origem, p_data_lote, p_assinatura, p_total_linhas, jsonb_array_length(p_baixas), auth.uid())
  RETURNING id INTO v_id;

  -- Casa pelo valor da parcela (o valor pago pode trazer juros de atraso) e pelo vencimento da parcela.
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
      AND abs(p.valor_parcela - coalesce((b->>'valor')::numeric, (b->>'valor_pago')::numeric)) <= 1
      AND p.data_prevista BETWEEN coalesce((b->>'vencimento')::date, (b->>'data_pagamento')::date) - 5
                              AND coalesce((b->>'vencimento')::date, (b->>'data_pagamento')::date) + 5
    ORDER BY (p.status = 'pendente') DESC, abs(p.data_prevista - coalesce((b->>'vencimento')::date, (b->>'data_pagamento')::date))
    LIMIT 1
  ) m ON true;

  SELECT count(*) INTO v_casadas FROM sftp_ume_baixas WHERE arquivo_id = v_id AND status = 'casado';
  UPDATE sftp_ume_arquivos SET casadas = v_casadas WHERE id = v_id;
  RETURN v_id;
END $function$;