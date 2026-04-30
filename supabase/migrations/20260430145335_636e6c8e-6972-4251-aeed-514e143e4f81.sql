-- Cria índice UNIQUE necessário para o ON CONFLICT (instancia_id, whatsapp_msg_id)
-- usado pelos edge functions whatsapp-chatbot, send-whatsapp, send-whatsapp-media,
-- send-whatsapp-audio, send-whatsapp-buttons e import-recent-whatsapp-chats.
-- Sem este índice, todos os upserts falham e as mensagens não são gravadas no Inbox.
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_mensagens_instancia_msgid_uniq
  ON public.whatsapp_mensagens (instancia_id, whatsapp_msg_id)
  WHERE whatsapp_msg_id IS NOT NULL;