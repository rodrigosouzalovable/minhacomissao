ALTER TABLE public.meta_whatsapp_instances
  ADD COLUMN IF NOT EXISTS rajada_taxa_atual smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rajada_ultimo_ajuste_em timestamptz;