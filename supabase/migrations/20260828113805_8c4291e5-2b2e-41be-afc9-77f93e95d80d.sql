ALTER TABLE public.meta_whatsapp_instances
  ADD COLUMN IF NOT EXISTS saude_restricoes jsonb;