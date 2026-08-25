CREATE TABLE public.iago_falhas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contato_id uuid,
  entrada_id text,
  motivo text NOT NULL,
  detalhe text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.iago_falhas TO authenticated;
GRANT ALL ON public.iago_falhas TO service_role;

ALTER TABLE public.iago_falhas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver falhas do IAGO"
ON public.iago_falhas FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_iago_falhas_criado_em ON public.iago_falhas (criado_em DESC);