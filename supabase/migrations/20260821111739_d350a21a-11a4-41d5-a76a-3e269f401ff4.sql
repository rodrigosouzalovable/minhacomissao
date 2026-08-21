CREATE UNIQUE INDEX IF NOT EXISTS admin_notificacoes_log_tipo_chave_uidx
  ON public.admin_notificacoes_log (tipo, chave_idempotencia)
  WHERE chave_idempotencia IS NOT NULL;