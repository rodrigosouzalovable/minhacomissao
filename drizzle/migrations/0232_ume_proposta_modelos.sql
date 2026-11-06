CREATE TABLE public.ume_proposta_modelos (
  user_id uuid PRIMARY KEY,
  texto text NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ume_proposta_modelos TO authenticated;
GRANT ALL ON public.ume_proposta_modelos TO service_role;
ALTER TABLE public.ume_proposta_modelos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dono gerencia modelo" ON public.ume_proposta_modelos FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());