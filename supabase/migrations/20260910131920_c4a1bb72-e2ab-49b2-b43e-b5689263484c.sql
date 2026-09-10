ALTER TABLE public.envio_meta_job
  ADD COLUMN IF NOT EXISTS dias_antirrepeticao integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS ignorados_repetidos jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.meta_envio_pool_config
  ADD COLUMN IF NOT EXISTS antirrepeticao_dias integer NOT NULL DEFAULT 7;