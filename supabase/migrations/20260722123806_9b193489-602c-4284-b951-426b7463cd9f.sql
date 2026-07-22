ALTER TABLE public.envio_meta_job ADD COLUMN IF NOT EXISTS msgs_por_segundo integer NOT NULL DEFAULT 10;
ALTER TABLE public.meta_whatsapp_instances ADD COLUMN IF NOT EXISTS rate_limit_ate timestamptz;