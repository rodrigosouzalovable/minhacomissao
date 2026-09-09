ALTER TABLE public.meta_aquecimento_trilha
  ADD COLUMN IF NOT EXISTS motivo text,
  ADD COLUMN IF NOT EXISTS origem_campanha_id uuid;

CREATE INDEX IF NOT EXISTS idx_gml_aquecimento_pool
  ON public.google_maps_leads (tem_whatsapp, usado_aquecimento_em);

CREATE INDEX IF NOT EXISTS idx_aq_destino_log_lead
  ON public.meta_aquecimento_destino_log (lead_id);