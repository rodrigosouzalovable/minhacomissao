ALTER TABLE public.whatsapp_mensagens
  ADD COLUMN IF NOT EXISTS status_envio text NOT NULL DEFAULT 'enviada';

ALTER TABLE public.whatsapp_mensagens
  DROP CONSTRAINT IF EXISTS whatsapp_mensagens_status_envio_check;

ALTER TABLE public.whatsapp_mensagens
  ADD CONSTRAINT whatsapp_mensagens_status_envio_check
  CHECK (status_envio IN ('enviando','enviada','entregue','lida','erro'));

CREATE INDEX IF NOT EXISTS idx_whatsapp_mensagens_status_envio_lookup
  ON public.whatsapp_mensagens(instancia_id, whatsapp_msg_id)
  WHERE whatsapp_msg_id IS NOT NULL;