ALTER TABLE public.whatsapp_mensagens
  ADD COLUMN IF NOT EXISTS quoted_msg_id text,
  ADD COLUMN IF NOT EXISTS quoted_conteudo text,
  ADD COLUMN IF NOT EXISTS quoted_direcao text;