CREATE TABLE public.sftp_ume_arquivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_arquivo text NOT NULL,
  origem text NOT NULL DEFAULT 'upload',
  data_lote date,
  assinatura text NOT NULL UNIQUE,
  total_linhas integer NOT NULL DEFAULT 0,
  total_baixas integer NOT NULL DEFAULT 0,
  casadas integer NOT NULL DEFAULT 0,
  aplicadas integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'importado',
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sftp_ume_arquivos TO authenticated;
GRANT ALL ON public.sftp_ume_arquivos TO service_role;
ALTER TABLE public.sftp_ume_arquivos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins leem arquivos SFTP" ON public.sftp_ume_arquivos FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE public.sftp_ume_baixas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  arquivo_id uuid NOT NULL REFERENCES public.sftp_ume_arquivos(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  cpf text NOT NULL,
  contrato text,
  parcela_ref text,
  vencimento date,
  valor numeric(12,2),
  data_pagamento date,
  valor_pago numeric(12,2),
  pagamento_id uuid,
  acordo_id uuid,
  status text NOT NULL DEFAULT 'sem_acordo',
  aplicado_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sftp_ume_baixas_arquivo ON public.sftp_ume_baixas(arquivo_id, status);
GRANT SELECT ON public.sftp_ume_baixas TO authenticated;
GRANT ALL ON public.sftp_ume_baixas TO service_role;
ALTER TABLE public.sftp_ume_baixas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins leem baixas SFTP" ON public.sftp_ume_baixas FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Registra um arquivo e suas baixas, casando cada uma com parcela pendente de acordo ativo UME/Odres
CREATE OR REPLACE FUNCTION public.sftp_ume_registrar(p_nome text, p_origem text, p_data_lote date,
  p_assinatura text, p_total_linhas integer, p_baixas jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_casadas integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas administradores.' USING ERRCODE = '42501';
  END IF;
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
END $$;
REVOKE ALL ON FUNCTION public.sftp_ume_registrar(text,text,date,text,integer,jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.sftp_ume_registrar(text,text,date,text,integer,jsonb) TO authenticated;

-- Marca como pagas as parcelas casadas de um arquivo
CREATE OR REPLACE FUNCTION public.sftp_ume_aplicar(p_arquivo uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_n integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas administradores.' USING ERRCODE = '42501';
  END IF;
  WITH alvo AS (
    SELECT DISTINCT ON (b.pagamento_id) b.id, b.pagamento_id, coalesce(b.data_pagamento, a.data_lote, current_date) dp
    FROM sftp_ume_baixas b JOIN sftp_ume_arquivos a ON a.id = b.arquivo_id
    WHERE b.arquivo_id = p_arquivo AND b.status = 'casado'
  ), upd AS (
    UPDATE pagamentos p SET status = 'pago', data_paga = alvo.dp
    FROM alvo WHERE p.id = alvo.pagamento_id AND p.status = 'pendente'
    RETURNING p.id
  )
  UPDATE sftp_ume_baixas b SET status = CASE WHEN b.pagamento_id IN (SELECT id FROM upd) THEN 'aplicado' ELSE 'ja_pago' END,
    aplicado_em = now()
  WHERE b.arquivo_id = p_arquivo AND b.status = 'casado';
  SELECT count(*) INTO v_n FROM sftp_ume_baixas WHERE arquivo_id = p_arquivo AND status = 'aplicado';
  UPDATE sftp_ume_arquivos SET aplicadas = v_n, casadas = 0, status = 'aplicado' WHERE id = p_arquivo;
  RETURN v_n;
END $$;
REVOKE ALL ON FUNCTION public.sftp_ume_aplicar(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.sftp_ume_aplicar(uuid) TO authenticated;