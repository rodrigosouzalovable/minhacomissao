ALTER TABLE public.envio_meta_job
  ADD COLUMN IF NOT EXISTS instancias_bloqueadas_run jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS falhas_por_instancia_run jsonb NOT NULL DEFAULT '{}'::jsonb;