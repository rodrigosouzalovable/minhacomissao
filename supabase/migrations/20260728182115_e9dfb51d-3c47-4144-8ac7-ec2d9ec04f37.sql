
CREATE TABLE public.google_maps_buscas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  categoria text NOT NULL,
  localizacao text NOT NULL,
  raio_metros integer,
  total_resultados integer NOT NULL DEFAULT 0,
  custo_estimado_usd numeric(10,4) DEFAULT 0,
  status text NOT NULL DEFAULT 'concluida',
  erro text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_maps_buscas TO authenticated;
GRANT ALL ON public.google_maps_buscas TO service_role;
ALTER TABLE public.google_maps_buscas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gm_buscas_admin_all" ON public.google_maps_buscas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.google_maps_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  busca_id uuid NOT NULL REFERENCES public.google_maps_buscas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  place_id text,
  nome text NOT NULL,
  telefone text,
  telefone_internacional text,
  endereco text,
  categoria text,
  site text,
  avaliacao numeric(3,2),
  total_avaliacoes integer,
  latitude numeric(10,7),
  longitude numeric(10,7),
  enviado_whatsapp boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_maps_leads TO authenticated;
GRANT ALL ON public.google_maps_leads TO service_role;
ALTER TABLE public.google_maps_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gm_leads_admin_all" ON public.google_maps_leads
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_gm_leads_busca ON public.google_maps_leads(busca_id);
CREATE INDEX idx_gm_leads_user ON public.google_maps_leads(user_id, created_at DESC);
CREATE INDEX idx_gm_leads_place ON public.google_maps_leads(place_id);
CREATE INDEX idx_gm_buscas_user ON public.google_maps_buscas(user_id, created_at DESC);

CREATE TRIGGER trg_gm_buscas_updated
  BEFORE UPDATE ON public.google_maps_buscas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
