ALTER TABLE public.envio_meta_job ADD COLUMN IF NOT EXISTS template_variantes jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.envio_meta_job_item ADD COLUMN IF NOT EXISTS variante_idx integer NOT NULL DEFAULT 0;
ALTER TABLE public.meta_campanha_agendada ADD COLUMN IF NOT EXISTS template_variantes jsonb NOT NULL DEFAULT '[]'::jsonb;