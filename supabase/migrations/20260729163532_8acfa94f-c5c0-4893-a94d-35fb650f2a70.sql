CREATE INDEX IF NOT EXISTS idx_envio_meta_job_item_job_status_proc
  ON public.envio_meta_job_item (job_id, status, processado_em DESC);

CREATE INDEX IF NOT EXISTS idx_meta_envios_log_user_enviado
  ON public.meta_whatsapp_envios_log (user_id, enviado_em DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_contatos_inst_arq_ult
  ON public.whatsapp_contatos (instancia_id, arquivado, ultima_mensagem_em DESC);