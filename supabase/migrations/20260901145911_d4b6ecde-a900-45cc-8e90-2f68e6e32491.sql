CREATE TABLE public.cloudflare_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_token text,
  account_id text,
  subdominio text,
  validado_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cloudflare_config TO authenticated;
GRANT ALL ON public.cloudflare_config TO service_role;

ALTER TABLE public.cloudflare_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam config cloudflare"
ON public.cloudflare_config FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER cloudflare_config_atualizado_em
BEFORE UPDATE ON public.cloudflare_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();