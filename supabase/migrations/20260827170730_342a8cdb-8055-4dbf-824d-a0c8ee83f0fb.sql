ALTER TABLE public.meta_envio_pool_config
  ADD COLUMN IF NOT EXISTS sem_teto_global boolean NOT NULL DEFAULT false;

ALTER TABLE public.meta_instance_freio_diario
  ADD COLUMN IF NOT EXISTS liberado_manual boolean NOT NULL DEFAULT false;

UPDATE public.meta_envio_pool_config SET sem_teto_global = true WHERE id = 1;