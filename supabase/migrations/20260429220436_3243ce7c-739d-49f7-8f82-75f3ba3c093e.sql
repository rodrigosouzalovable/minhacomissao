ALTER TABLE public.user_whatsapp_instances
  ADD COLUMN IF NOT EXISTS historico_inicial_importado_em timestamptz;