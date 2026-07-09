
-- Colunas para separar envios cobrados vs grátis (CSW) no log
ALTER TABLE public.meta_whatsapp_envios_log
  ADD COLUMN IF NOT EXISTS foi_gratis boolean,
  ADD COLUMN IF NOT EXISTS pricing_category text,
  ADD COLUMN IF NOT EXISTS pricing_type text;

CREATE INDEX IF NOT EXISTS idx_meta_envios_log_pricing
  ON public.meta_whatsapp_envios_log (enviado_em DESC)
  WHERE foi_gratis IS NOT NULL;

-- Config de relatório diário de custo Meta (destinatário/horário/toggle)
CREATE TABLE IF NOT EXISTS public.meta_billing_relatorio_config (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  ativo boolean NOT NULL DEFAULT true,
  telefone_destino text NOT NULL DEFAULT '62991672674',
  hora_envio text NOT NULL DEFAULT '08:30',
  incluir_projecao boolean NOT NULL DEFAULT true,
  incluir_top_templates boolean NOT NULL DEFAULT true,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid
);

GRANT SELECT ON public.meta_billing_relatorio_config TO authenticated;
GRANT ALL ON public.meta_billing_relatorio_config TO service_role;
ALTER TABLE public.meta_billing_relatorio_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read meta billing report config"
  ON public.meta_billing_relatorio_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin update meta billing report config"
  ON public.meta_billing_relatorio_config FOR UPDATE TO authenticated
  USING (is_admin_user(auth.uid())) WITH CHECK (is_admin_user(auth.uid()));
CREATE POLICY "admin insert meta billing report config"
  ON public.meta_billing_relatorio_config FOR INSERT TO authenticated
  WITH CHECK (is_admin_user(auth.uid()));

INSERT INTO public.meta_billing_relatorio_config (id) VALUES (1)
  ON CONFLICT (id) DO NOTHING;

-- Meta mensal de gasto (limite BRL) + flags de alerta
CREATE TABLE IF NOT EXISTS public.meta_billing_meta_mensal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mes_ano text NOT NULL UNIQUE,
  limite_brl numeric(12,2) NOT NULL DEFAULT 800,
  alerta_50pct_enviado boolean NOT NULL DEFAULT false,
  alerta_80pct_enviado boolean NOT NULL DEFAULT false,
  alerta_100pct_enviado boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.meta_billing_meta_mensal TO authenticated;
GRANT ALL ON public.meta_billing_meta_mensal TO service_role;
ALTER TABLE public.meta_billing_meta_mensal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read meta mensal"
  ON public.meta_billing_meta_mensal FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage meta mensal"
  ON public.meta_billing_meta_mensal FOR ALL TO authenticated
  USING (is_admin_user(auth.uid())) WITH CHECK (is_admin_user(auth.uid()));

-- Cron diário 08:30 BRT (11:30 UTC) para relatório de custo Meta.
-- pg_cron e pg_net já estão habilitados no projeto (usado por outros relatórios).
DO $$
BEGIN
  PERFORM cron.unschedule('daily-report-meta-billing');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'daily-report-meta-billing',
  '30 11 * * *',
  $$
  SELECT net.http_post(
    url:='https://cymdrkeukockakfzjeen.supabase.co/functions/v1/daily-report-meta-billing',
    headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5bWRya2V1a29ja2FrZnpqZWVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNjI0OTQsImV4cCI6MjA4MTYzODQ5NH0.mjcAvZDXLA6m46JCR474jZDHOF2WmWUXygChA4z__2U"}'::jsonb,
    body:=jsonb_build_object('trigger','cron','ts',now())
  );
  $$
);
