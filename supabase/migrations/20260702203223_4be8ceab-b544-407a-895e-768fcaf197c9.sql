
CREATE TABLE public.meta_billing_snapshot (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  waba_id TEXT NOT NULL,
  dia DATE NOT NULL,
  conversation_category TEXT NOT NULL,
  conversation_type TEXT,
  conversations_count INTEGER NOT NULL DEFAULT 0,
  cost_usd NUMERIC(12,4) NOT NULL DEFAULT 0,
  cost_brl NUMERIC(12,2) NOT NULL DEFAULT 0,
  fx_rate NUMERIC(10,4) NOT NULL DEFAULT 5.5,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(waba_id, dia, conversation_category, conversation_type)
);

GRANT SELECT ON public.meta_billing_snapshot TO authenticated;
GRANT ALL ON public.meta_billing_snapshot TO service_role;

ALTER TABLE public.meta_billing_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins visualizam billing snapshot"
ON public.meta_billing_snapshot FOR SELECT TO authenticated
USING (public.is_admin_user(auth.uid()));

CREATE INDEX idx_meta_billing_snapshot_dia ON public.meta_billing_snapshot(dia DESC);
CREATE INDEX idx_meta_billing_snapshot_waba ON public.meta_billing_snapshot(waba_id);

CREATE TRIGGER meta_billing_snapshot_updated
BEFORE UPDATE ON public.meta_billing_snapshot
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE public.meta_billing_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  waba_id TEXT,
  tipo TEXT NOT NULL,
  valor_usd NUMERIC(12,4),
  valor_brl NUMERIC(12,2),
  detalhes JSONB NOT NULL DEFAULT '{}'::jsonb,
  ocorreu_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  notificado_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.meta_billing_alerts TO authenticated;
GRANT ALL ON public.meta_billing_alerts TO service_role;

ALTER TABLE public.meta_billing_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins visualizam billing alerts"
ON public.meta_billing_alerts FOR SELECT TO authenticated
USING (public.is_admin_user(auth.uid()));

CREATE INDEX idx_meta_billing_alerts_ocorreu ON public.meta_billing_alerts(ocorreu_em DESC);
CREATE INDEX idx_meta_billing_alerts_tipo ON public.meta_billing_alerts(tipo);
