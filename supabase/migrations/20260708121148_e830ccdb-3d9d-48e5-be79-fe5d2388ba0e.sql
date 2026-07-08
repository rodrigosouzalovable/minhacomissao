ALTER TABLE public.user_permissions
  ADD COLUMN IF NOT EXISTS recebe_consulta_cpf boolean DEFAULT false;