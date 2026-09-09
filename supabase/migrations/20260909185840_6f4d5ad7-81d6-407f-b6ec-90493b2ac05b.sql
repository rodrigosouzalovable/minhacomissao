CREATE INDEX IF NOT EXISTS idx_gml_created_at ON public.google_maps_leads USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gml_categoria ON public.google_maps_leads USING btree (categoria);
CREATE INDEX IF NOT EXISTS idx_gml_resultado ON public.google_maps_leads USING btree (resultado_aquecimento);