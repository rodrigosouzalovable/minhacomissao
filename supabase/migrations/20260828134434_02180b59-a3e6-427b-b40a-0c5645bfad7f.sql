CREATE TABLE public.google_maps_nicho_analises (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  busca_id uuid NOT NULL REFERENCES public.google_maps_buscas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  categoria text NOT NULL,
  localizacao text NOT NULL,
  estilo text,
  sites_lidos integer NOT NULL DEFAULT 0,
  sites_falharam integer NOT NULL DEFAULT 0,
  resumo jsonb,
  prompt text,
  lead_alvo_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_gm_nicho_analises_busca ON public.google_maps_nicho_analises (busca_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_maps_nicho_analises TO authenticated;
GRANT ALL ON public.google_maps_nicho_analises TO service_role;

ALTER TABLE public.google_maps_nicho_analises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam analises de nicho"
ON public.google_maps_nicho_analises
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid())
WITH CHECK (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid());