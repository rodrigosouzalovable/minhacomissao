ALTER TABLE public.admin_notificacoes_config
  ADD COLUMN IF NOT EXISTS instancia_notificacao_id uuid REFERENCES public.user_whatsapp_instances(id) ON DELETE SET NULL;