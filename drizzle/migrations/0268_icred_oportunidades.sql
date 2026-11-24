CREATE TABLE public.icred_oportunidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cpf text NOT NULL,
  nome text,
  celular text,
  produto text NOT NULL DEFAULT 'FGTS',
  valor_liberado numeric,
  status text NOT NULL DEFAULT 'NOVO',
  lote text,
  observacao text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cpf, produto)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.icred_oportunidades TO authenticated;
GRANT ALL ON public.icred_oportunidades TO service_role;
ALTER TABLE public.icred_oportunidades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins gerenciam oportunidades iCred" ON public.icred_oportunidades
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX icred_oportunidades_status_idx ON public.icred_oportunidades (status, created_at DESC);