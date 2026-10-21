CREATE TABLE public.ume_acordo_api_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  cpf text NOT NULL,
  borrower_id text NOT NULL,
  conversa_id uuid,
  ambiente text NOT NULL,
  acao text NOT NULL,
  parcelas integer NOT NULL,
  primeiro_vencimento date NOT NULL,
  desconto numeric(12,2) NOT NULL,
  juros numeric(8,4) NOT NULL DEFAULT 0,
  installment_ids text[] NOT NULL,
  sucesso boolean NOT NULL,
  resposta jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ume_acordo_api_log TO authenticated;
GRANT ALL ON public.ume_acordo_api_log TO service_role;
ALTER TABLE public.ume_acordo_api_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins ou autor leem log de acordos UME" ON public.ume_acordo_api_log FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE INDEX idx_ume_acordo_api_log_cpf ON public.ume_acordo_api_log(cpf, criado_em DESC);