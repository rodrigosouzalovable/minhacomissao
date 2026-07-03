
ALTER TABLE public.meta_whatsapp_contatos
  ADD COLUMN IF NOT EXISTS bsuid text,
  ADD COLUMN IF NOT EXISTS whatsapp_username text,
  ADD COLUMN IF NOT EXISTS ultima_interacao_em timestamptz,
  ADD COLUMN IF NOT EXISTS telefone_visivel boolean NOT NULL DEFAULT true;

ALTER TABLE public.meta_whatsapp_contatos
  ALTER COLUMN telefone DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_meta_contatos_bsuid
  ON public.meta_whatsapp_contatos(instancia_id, bsuid)
  WHERE bsuid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_meta_contatos_username
  ON public.meta_whatsapp_contatos(instancia_id, whatsapp_username)
  WHERE whatsapp_username IS NOT NULL;

ALTER TABLE public.meta_whatsapp_mensagens
  ADD COLUMN IF NOT EXISTS bsuid text;

ALTER TABLE public.meta_whatsapp_envios_log
  ADD COLUMN IF NOT EXISTS bsuid text;

CREATE INDEX IF NOT EXISTS idx_meta_mensagens_bsuid
  ON public.meta_whatsapp_mensagens(instancia_id, bsuid)
  WHERE bsuid IS NOT NULL;
