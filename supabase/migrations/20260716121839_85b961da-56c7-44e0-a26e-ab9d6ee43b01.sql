ALTER TABLE public.envio_meta_job_item
  ADD COLUMN IF NOT EXISTS tentativas int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wa_message_id text;

CREATE INDEX IF NOT EXISTS idx_envio_meta_job_item_wa_message_id
  ON public.envio_meta_job_item(wa_message_id)
  WHERE wa_message_id IS NOT NULL;