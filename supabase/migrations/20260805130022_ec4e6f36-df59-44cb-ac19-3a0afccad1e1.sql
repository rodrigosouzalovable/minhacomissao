ALTER TABLE public.tresc_config
  ADD COLUMN IF NOT EXISTS webhook_key uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS ultimo_webhook_em timestamp with time zone,
  ADD COLUMN IF NOT EXISTS ultimo_webhook_tipo text;