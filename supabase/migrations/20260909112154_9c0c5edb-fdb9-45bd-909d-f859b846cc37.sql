ALTER TABLE public.envio_meta_job
  ADD COLUMN IF NOT EXISTS validar_no_envio boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sem_whatsapp integer NOT NULL DEFAULT 0;

ALTER TABLE public.envio_meta_job_item
  ADD COLUMN IF NOT EXISTS wa_validado text;

CREATE INDEX IF NOT EXISTS idx_envio_meta_job_item_pend_val
  ON public.envio_meta_job_item (job_id, ordem)
  WHERE status = 'pendente' AND wa_validado IS NULL;