CREATE TABLE public.portal_dominios (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hostname text NOT NULL UNIQUE,
  responsavel_nome text,
  telefone text NOT NULL,
  telefone_display text NOT NULL,
  email text NOT NULL,
  noindex boolean NOT NULL DEFAULT true,
  ativo boolean NOT NULL DEFAULT true,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.portal_dominios TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_dominios TO authenticated;
GRANT ALL ON public.portal_dominios TO service_role;

ALTER TABLE public.portal_dominios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "portal_dominios_public_select" ON public.portal_dominios
FOR SELECT TO anon, authenticated USING (ativo = true);

CREATE POLICY "portal_dominios_admin_all" ON public.portal_dominios
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER portal_dominios_updated_at
BEFORE UPDATE ON public.portal_dominios
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.portal_dominios (hostname, responsavel_nome, telefone, telefone_display, email, noindex)
VALUES ('luizcarlos.meusacordos.com.br', 'Luiz Carlos', '5562981474256', '(62) 98147-4256', 'luizcarlos@souzaeribeiro.com.br', true)
ON CONFLICT (hostname) DO NOTHING;