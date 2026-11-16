CREATE TABLE public.usa_b2b_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone text NOT NULL UNIQUE,
  nome text,
  cidade text,
  nicho text,
  place_id text,
  enviado_em timestamptz,
  job_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX usa_b2b_leads_pendentes ON public.usa_b2b_leads (created_at) WHERE enviado_em IS NULL;
GRANT SELECT ON public.usa_b2b_leads TO authenticated;
GRANT ALL ON public.usa_b2b_leads TO service_role;
ALTER TABLE public.usa_b2b_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins leem leads usa" ON public.usa_b2b_leads FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.usa_b2b_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  ativo boolean NOT NULL DEFAULT true,
  limite_dia integer NOT NULL DEFAULT 300,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.usa_b2b_config TO authenticated;
GRANT ALL ON public.usa_b2b_config TO service_role;
ALTER TABLE public.usa_b2b_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins gerem config usa" ON public.usa_b2b_config FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.usa_b2b_config (id) VALUES (true);