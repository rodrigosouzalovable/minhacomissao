
ALTER TABLE public.user_whatsapp_instances
  ADD COLUMN IF NOT EXISTS proxy_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS proxy_type text NOT NULL DEFAULT 'socks5',
  ADD COLUMN IF NOT EXISTS proxy_host text,
  ADD COLUMN IF NOT EXISTS proxy_port integer,
  ADD COLUMN IF NOT EXISTS proxy_username text,
  ADD COLUMN IF NOT EXISTS proxy_password text,
  ADD COLUMN IF NOT EXISTS proxy_aplicado_em timestamptz,
  ADD COLUMN IF NOT EXISTS proxy_ultimo_erro text;

CREATE TABLE IF NOT EXISTS public.system_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage system_settings" ON public.system_settings;
CREATE POLICY "Admins manage system_settings"
ON public.system_settings
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated read system_settings" ON public.system_settings;
CREATE POLICY "Authenticated read system_settings"
ON public.system_settings
FOR SELECT
TO authenticated
USING (true);
