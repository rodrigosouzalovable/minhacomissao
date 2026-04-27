-- Kill switch global
CREATE TABLE IF NOT EXISTS public.system_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage system_config"
  ON public.system_config FOR ALL
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

CREATE POLICY "Authenticated read system_config"
  ON public.system_config FOR SELECT
  TO authenticated
  USING (true);

INSERT INTO public.system_config (key, value)
VALUES ('ai_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Log de uso de IA
CREATE TABLE IF NOT EXISTS public.ai_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text NOT NULL,
  model text,
  user_id uuid,
  prompt_chars integer,
  status text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_log_created_at ON public.ai_usage_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_function ON public.ai_usage_log(function_name);

ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view ai_usage_log"
  ON public.ai_usage_log FOR SELECT
  USING (public.is_admin_user(auth.uid()));

CREATE POLICY "Service inserts ai_usage_log"
  ON public.ai_usage_log FOR INSERT
  WITH CHECK (true);

-- Pausar cron daily-report-advanced (se existir)
DO $$
BEGIN
  PERFORM cron.unschedule(jobname)
  FROM cron.job
  WHERE jobname ILIKE '%daily-report-advanced%' OR jobname ILIKE '%daily_report_advanced%';
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;