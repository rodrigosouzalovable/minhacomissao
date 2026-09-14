CREATE INDEX IF NOT EXISTS idx_meta_envios_log_wamid_latest
ON public.meta_whatsapp_envios_log (wa_message_id, enviado_em DESC, id DESC)
WHERE wa_message_id IS NOT NULL;