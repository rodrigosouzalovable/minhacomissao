ALTER TABLE public.envio_meta_job
  ADD COLUMN IF NOT EXISTS instancias_risco_aceito text[] NOT NULL DEFAULT '{}';