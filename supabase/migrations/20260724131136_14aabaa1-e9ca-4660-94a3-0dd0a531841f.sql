
ALTER TABLE public.meta_whatsapp_instances
  ADD COLUMN IF NOT EXISTS webhook_saude_status text,
  ADD COLUMN IF NOT EXISTS webhook_saude_verificado_em timestamptz,
  ADD COLUMN IF NOT EXISTS webhook_ultimo_erro text,
  ADD COLUMN IF NOT EXISTS webhook_callback_url text,
  ADD COLUMN IF NOT EXISTS webhook_perda_suspeita jsonb;
