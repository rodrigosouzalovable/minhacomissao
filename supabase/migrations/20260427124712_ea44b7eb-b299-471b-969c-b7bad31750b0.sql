
-- Tabela de configuração de orçamento (singleton)
CREATE TABLE public.ai_budget_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  daily_limit_calls INTEGER NOT NULL DEFAULT 500,
  daily_limit_chars BIGINT NOT NULL DEFAULT 2000000,
  hourly_limit_calls INTEGER NOT NULL DEFAULT 100,
  alert_phone TEXT NOT NULL DEFAULT '62991672674',
  alert_threshold_pct INTEGER NOT NULL DEFAULT 70,
  auto_block_on_limit BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT singleton CHECK (id = 1)
);

ALTER TABLE public.ai_budget_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam orçamento IA"
ON public.ai_budget_config FOR ALL
USING (public.is_admin_user(auth.uid()))
WITH CHECK (public.is_admin_user(auth.uid()));

INSERT INTO public.ai_budget_config (id) VALUES (1);

-- Limites por função
CREATE TABLE public.ai_function_limits (
  function_name TEXT PRIMARY KEY,
  daily_limit INTEGER NOT NULL DEFAULT 50,
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_function_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam limites por função"
ON public.ai_function_limits FOR ALL
USING (public.is_admin_user(auth.uid()))
WITH CHECK (public.is_admin_user(auth.uid()));

INSERT INTO public.ai_function_limits (function_name, daily_limit) VALUES
  ('whatsapp-mentor', 50),
  ('teach-chatbot', 100),
  ('gerar-estrategia-cobranca', 30),
  ('daily-report-advanced', 5),
  ('analyze-cobmais-screen', 30),
  ('chat-cobmais-knowledge', 50),
  ('extract-acordo-data', 30),
  ('extract-pdf-acordo', 30),
  ('extract-texto-acordo', 30),
  ('gerar-termo-acordo', 30),
  ('process-cobmais-video', 10),
  ('process-pos-atendimento', 30),
  ('transcribe-audio', 50);

-- Alertas enviados (anti-spam: 1 por dia por tipo)
CREATE TABLE public.ai_alerts_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  alert_type TEXT NOT NULL,
  function_name TEXT,
  phone TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(data, alert_type, function_name)
);

ALTER TABLE public.ai_alerts_sent ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins veem alertas"
ON public.ai_alerts_sent FOR SELECT
USING (public.is_admin_user(auth.uid()));

-- Snapshot diário
CREATE TABLE public.ai_daily_snapshot (
  data DATE PRIMARY KEY DEFAULT CURRENT_DATE,
  total_calls INTEGER NOT NULL DEFAULT 0,
  total_chars BIGINT NOT NULL DEFAULT 0,
  blocked_calls INTEGER NOT NULL DEFAULT 0,
  top_function TEXT,
  by_function JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_daily_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins veem snapshot"
ON public.ai_daily_snapshot FOR SELECT
USING (public.is_admin_user(auth.uid()));

-- Index pra performance no ai_usage_log
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_created_at ON public.ai_usage_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_function_created ON public.ai_usage_log(function_name, created_at DESC);
