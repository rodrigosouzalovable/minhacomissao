ALTER TABLE public.certificado_config
  ADD COLUMN IF NOT EXISTS prospeccao_instancia_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

ALTER TABLE public.certificado_leads
  ADD COLUMN IF NOT EXISTS preparacao_id uuid;

CREATE TABLE public.certificado_prospeccao_preparacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitante_id uuid NOT NULL,
  quantidade_alvo integer NOT NULL CHECK (quantidade_alvo > 0),
  janela integer NOT NULL CHECK (janela BETWEEN 0 AND 30),
  data_alvo date NOT NULL,
  bm_id uuid NOT NULL REFERENCES public.meta_business_managers(id),
  template_nome text NOT NULL,
  template_idioma text NOT NULL DEFAULT 'pt_BR',
  instancia_ids uuid[] NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','processando','pronta','campanha_criada','falhou','pausada')),
  pagina_atual integer NOT NULL DEFAULT 1,
  cnpjs_consultados integer NOT NULL DEFAULT 0,
  leads_novos integer NOT NULL DEFAULT 0,
  numeros_verificados integer NOT NULL DEFAULT 0,
  confirmados_whatsapp integer NOT NULL DEFAULT 0,
  erro text,
  lease_ate timestamptz,
  job_id uuid REFERENCES public.envio_meta_job(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  concluido_em timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.certificado_prospeccao_preparacoes TO authenticated;
GRANT ALL ON public.certificado_prospeccao_preparacoes TO service_role;

ALTER TABLE public.certificado_prospeccao_preparacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage certificado preparations"
ON public.certificado_prospeccao_preparacoes
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE UNIQUE INDEX certificado_preparacao_ativa_unica_idx
ON public.certificado_prospeccao_preparacoes ((true))
WHERE status IN ('pendente','processando','pronta');

CREATE INDEX certificado_preparacao_status_idx
ON public.certificado_prospeccao_preparacoes (status, created_at DESC);

CREATE INDEX certificado_leads_preparacao_idx
ON public.certificado_leads (preparacao_id, whatsapp_status, situacao)
WHERE preparacao_id IS NOT NULL;

COMMENT ON COLUMN public.certificado_config.prospeccao_instancia_ids IS 'Instâncias Meta escolhidas para a prospecção do Certificado Digital.';
COMMENT ON COLUMN public.certificado_leads.preparacao_id IS 'Vincula leads inéditos à preparação manual que os extraiu.';
COMMENT ON TABLE public.certificado_prospeccao_preparacoes IS 'Progresso retomável das captações manuais por quantidade do Certificado Digital.';