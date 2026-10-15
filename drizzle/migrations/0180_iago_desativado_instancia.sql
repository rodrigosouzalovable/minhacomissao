ALTER TABLE public.user_whatsapp_instances
  ADD COLUMN IF NOT EXISTS iago_desativado boolean NOT NULL DEFAULT false;
UPDATE public.user_whatsapp_instances SET iago_desativado = true
  WHERE id = '7c8d7028-5c16-4783-b5e6-69d630480e0f';