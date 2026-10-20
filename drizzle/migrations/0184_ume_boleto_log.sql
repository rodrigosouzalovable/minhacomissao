CREATE TABLE public.ume_boleto_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  cpf TEXT NOT NULL,
  borrower_id TEXT NOT NULL,
  invoice_id TEXT,
  valor NUMERIC(12,2),
  vencimento DATE NOT NULL,
  invoice_url TEXT,
  origem TEXT NOT NULL DEFAULT 'atendente' CHECK (origem IN ('atendente','iago')),
  ambiente TEXT NOT NULL DEFAULT 'dev' CHECK (ambiente IN ('dev','prd')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.ume_boleto_log TO authenticated;
GRANT ALL ON public.ume_boleto_log TO service_role;

ALTER TABLE public.ume_boleto_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuario ve os proprios boletos"
  ON public.ume_boleto_log FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "usuario registra o proprio boleto"
  ON public.ume_boleto_log FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_ume_boleto_log_cpf ON public.ume_boleto_log (cpf, criado_em DESC);