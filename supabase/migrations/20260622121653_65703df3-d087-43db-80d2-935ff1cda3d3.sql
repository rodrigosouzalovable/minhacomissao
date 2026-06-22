ALTER TABLE public.meta_whatsapp_instances
  ADD COLUMN IF NOT EXISTS saude_status text,
  ADD COLUMN IF NOT EXISTS saude_quality text,
  ADD COLUMN IF NOT EXISTS saude_tier text,
  ADD COLUMN IF NOT EXISTS saude_name_status text,
  ADD COLUMN IF NOT EXISTS saude_throughput jsonb,
  ADD COLUMN IF NOT EXISTS saude_ban_info jsonb,
  ADD COLUMN IF NOT EXISTS saude_raw jsonb,
  ADD COLUMN IF NOT EXISTS saude_checked_at timestamptz;