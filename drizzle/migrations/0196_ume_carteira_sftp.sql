CREATE TABLE public.ume_carteira_clientes (
  cpf text PRIMARY KEY,
  borrower_id text NOT NULL,
  nome text,
  carteira text NOT NULL,
  data_lote date NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ume_carteira_clientes TO authenticated;
GRANT ALL ON public.ume_carteira_clientes TO service_role;
ALTER TABLE public.ume_carteira_clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins leem carteira UME" ON public.ume_carteira_clientes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE INDEX idx_ume_carteira_clientes_borrower ON public.ume_carteira_clientes(borrower_id);

CREATE TABLE public.ume_carteira_parcelas (
  installment_id text PRIMARY KEY,
  cpf text NOT NULL,
  borrower_id text NOT NULL,
  contrato text,
  vencimento date,
  valor numeric(12,2),
  carteira text NOT NULL,
  data_lote date NOT NULL
);
GRANT SELECT ON public.ume_carteira_parcelas TO authenticated;
GRANT ALL ON public.ume_carteira_parcelas TO service_role;
ALTER TABLE public.ume_carteira_parcelas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins leem parcelas UME" ON public.ume_carteira_parcelas FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE INDEX idx_ume_carteira_parcelas_cpf ON public.ume_carteira_parcelas(cpf, vencimento);
CREATE INDEX idx_ume_carteira_parcelas_lote ON public.ume_carteira_parcelas(carteira, data_lote);

-- Grava um bloco de clientes/parcelas de um lote (arquivo diário = retrato completo da carteira)
CREATE OR REPLACE FUNCTION public.ume_carteira_gravar(p_carteira text, p_lote date, p_clientes jsonb, p_parcelas jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_n integer := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas administradores.' USING ERRCODE = '42501';
  END IF;
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
END $$;
REVOKE ALL ON FUNCTION public.ume_carteira_gravar(text,date,jsonb,jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.ume_carteira_gravar(text,date,jsonb,jsonb) TO authenticated;

-- Após gravar o lote inteiro: remove parcelas que saíram da carteira (pagas/baixadas)
CREATE OR REPLACE FUNCTION public.ume_carteira_finalizar(p_carteira text, p_lote date)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_n integer := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas administradores.' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM ume_carteira_parcelas WHERE carteira = p_carteira AND data_lote > p_lote) THEN
    RETURN 0; -- arquivo antigo: nunca apaga dados de um lote mais novo
  END IF;
  DELETE FROM ume_carteira_parcelas WHERE carteira = p_carteira AND data_lote < p_lote;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END $$;
REVOKE ALL ON FUNCTION public.ume_carteira_finalizar(text,date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.ume_carteira_finalizar(text,date) TO authenticated;