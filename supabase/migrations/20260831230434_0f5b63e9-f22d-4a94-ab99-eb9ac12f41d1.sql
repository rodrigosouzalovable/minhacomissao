ALTER TABLE public.meta_partner_clients
  ADD COLUMN IF NOT EXISTS access_token text,
  ADD COLUMN IF NOT EXISTS token_expira_em timestamptz,
  ADD COLUMN IF NOT EXISTS refresh_token text,
  ADD COLUMN IF NOT EXISTS meta_app_id text,
  ADD COLUMN IF NOT EXISTS meta_business_id text,
  ADD COLUMN IF NOT EXISTS meta_system_user_id text;

CREATE INDEX IF NOT EXISTS idx_meta_partner_clients_token_expira ON public.meta_partner_clients(token_expira_em);