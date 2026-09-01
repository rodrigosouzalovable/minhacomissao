CREATE TABLE public.sites_gerados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj text NOT NULL,
  razao_social text NOT NULL,
  nome_site text,
  telefone text,
  email text,
  endereco text,
  bairro text,
  cidade text,
  uf text,
  cep text,
  cnae text,
  abertura text,
  sobre text,
  foto_url text,
  meta_verification text,
  worker_name text,
  url text,
  status text NOT NULL DEFAULT 'rascunho',
  publicado_em timestamptz,
  criado_por uuid NOT NULL DEFAULT auth.uid(),
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sites_gerados TO authenticated;
GRANT ALL ON public.sites_gerados TO service_role;

ALTER TABLE public.sites_gerados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam todos os sites"
ON public.sites_gerados FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Usuarios gerenciam seus proprios sites"
ON public.sites_gerados FOR ALL TO authenticated
USING (criado_por = auth.uid())
WITH CHECK (criado_por = auth.uid());

CREATE INDEX idx_sites_gerados_criado_por ON public.sites_gerados(criado_por);
CREATE INDEX idx_sites_gerados_cnpj ON public.sites_gerados(cnpj);

CREATE TRIGGER set_sites_gerados_atualizado_em
BEFORE UPDATE ON public.sites_gerados
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS meus_sites boolean NOT NULL DEFAULT false;