ALTER TABLE public.google_maps_leads
  ADD COLUMN IF NOT EXISTS tem_whatsapp boolean,
  ADD COLUMN IF NOT EXISTS whatsapp_verificado_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_gm_leads_busca_whatsapp ON public.google_maps_leads (busca_id, tem_whatsapp);