ALTER TABLE public.meta_whatsapp_mensagens
ADD COLUMN IF NOT EXISTS payload_diagnostico JSONB;

COMMENT ON COLUMN public.meta_whatsapp_mensagens.payload_diagnostico IS
'Fragmento seguro do evento de mensagem preservado apenas quando o formato recebido da Meta não é reconhecido pelo parser.';