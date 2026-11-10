CREATE TABLE public.prospeccao_b2b_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  apollo_person_id text NOT NULL,
  nome text,
  sobrenome text,
  cargo text,
  empresa text,
  empresa_dominio text,
  segmento text,
  cidade text,
  linkedin_url text,
  email text,
  email_status text,
  telefone text,
  revelado boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'novo',
  observacoes text,
  ultimo_contato_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, apollo_person_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospeccao_b2b_leads TO authenticated;
GRANT ALL ON public.prospeccao_b2b_leads TO service_role;
ALTER TABLE public.prospeccao_b2b_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin gerencia proprios leads b2b" ON public.prospeccao_b2b_leads
FOR ALL TO authenticated
USING (owner_id = auth.uid() AND public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (owner_id = auth.uid() AND public.has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX prospeccao_b2b_leads_owner_status_idx ON public.prospeccao_b2b_leads (owner_id, status, created_at DESC);