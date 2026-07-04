CREATE INDEX IF NOT EXISTS idx_meta_envios_log_instancia_dia
  ON public.meta_whatsapp_envios_log (instancia_id, enviado_em);