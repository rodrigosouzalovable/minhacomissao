ALTER TABLE public.user_permissions
  ADD COLUMN IF NOT EXISTS notificar_acesso_whatsapp boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_permissions.notificar_acesso_whatsapp IS
  'Envia uma notificação pessoal ao administrador a cada nova abertura autenticada do sistema pelo usuário.';