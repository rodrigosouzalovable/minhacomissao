-- Remover índices únicos parciais redundantes (não funcionam com ON CONFLICT)
DROP INDEX IF EXISTS public.whatsapp_mensagens_msgid_unique;
DROP INDEX IF EXISTS public.whatsapp_mensagens_instancia_msgid_uniq;

-- Criar constraint UNIQUE real (permite múltiplos NULLs por padrão no Postgres)
ALTER TABLE public.whatsapp_mensagens
  ADD CONSTRAINT whatsapp_mensagens_inst_msgid_unique
  UNIQUE (instancia_id, whatsapp_msg_id);