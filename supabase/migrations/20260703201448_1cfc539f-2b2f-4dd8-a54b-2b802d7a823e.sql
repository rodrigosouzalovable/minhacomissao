
CREATE TABLE IF NOT EXISTS public.meta_billing_guardrail (
  id integer PRIMARY KEY DEFAULT 1,
  bloquear_marketing boolean NOT NULL DEFAULT true,
  limite_diario_usd numeric NOT NULL DEFAULT 5,
  notificar_admin boolean NOT NULL DEFAULT true,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid,
  CONSTRAINT meta_billing_guardrail_singleton CHECK (id = 1)
);

INSERT INTO public.meta_billing_guardrail (id) VALUES (1)
  ON CONFLICT (id) DO NOTHING;

GRANT SELECT ON public.meta_billing_guardrail TO authenticated;
GRANT ALL ON public.meta_billing_guardrail TO service_role;

ALTER TABLE public.meta_billing_guardrail ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can read guardrail"
  ON public.meta_billing_guardrail FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "admin can update guardrail"
  ON public.meta_billing_guardrail FOR UPDATE
  TO authenticated
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));
