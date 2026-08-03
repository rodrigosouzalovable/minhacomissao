ALTER TABLE public.meta_whatsapp_instances
  ADD COLUMN IF NOT EXISTS meta_verified_name text,
  ADD COLUMN IF NOT EXISTS meta_name_status text,
  ADD COLUMN IF NOT EXISTS meta_profile_pic_url text,
  ADD COLUMN IF NOT EXISTS meta_profile_about text,
  ADD COLUMN IF NOT EXISTS meta_perfil_sync_em timestamptz;