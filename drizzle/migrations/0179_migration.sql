ALTER TABLE public.admin_notificacoes_config
  ADD COLUMN IF NOT EXISTS tipos_permitidos text[],
  ADD COLUMN IF NOT EXISTS instancia_fixa_id uuid;