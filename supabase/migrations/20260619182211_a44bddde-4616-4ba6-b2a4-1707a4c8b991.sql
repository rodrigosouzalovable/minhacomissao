CREATE TABLE public.meta_whatsapp_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chave TEXT NOT NULL UNIQUE,
  valor TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_whatsapp_config TO authenticated;
GRANT ALL ON public.meta_whatsapp_config TO service_role;

ALTER TABLE public.meta_whatsapp_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can manage meta whatsapp config"
  ON public.meta_whatsapp_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.meta_whatsapp_config (chave, valor)
VALUES ('webhook_verify_token', 'hk-meta-' || gen_random_uuid()::text)
ON CONFLICT (chave) DO NOTHING;
