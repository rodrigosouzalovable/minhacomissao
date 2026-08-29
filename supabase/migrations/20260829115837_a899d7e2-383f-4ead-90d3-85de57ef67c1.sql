CREATE TABLE public.certificado_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  motor_ativo boolean NOT NULL DEFAULT false,
  ufs text[] NOT NULL DEFAULT ARRAY['GO','SP','RS','RJ','SC','DF'],
  cnaes text[] NOT NULL DEFAULT ARRAY['6911701','7020400','8630504','7490104','4712100','6319400','7319002','8630503','8112500','4120400','6201501','9602501','4772500','4751201','4781400','4530703','6204000'],
  janelas_dias int[] NOT NULL DEFAULT ARRAY[0,1,2,3,4,5,6,7,10,14,21,30],
  somente_mei boolean NOT NULL DEFAULT false,
  somente_celular boolean NOT NULL DEFAULT true,
  hora_execucao int NOT NULL DEFAULT 7,
  ultima_execucao timestamptz,
  ultimo_status text,
  total_coletado bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.certificado_config TO authenticated;
GRANT ALL ON public.certificado_config TO service_role;
ALTER TABLE public.certificado_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cert_config_admin_all" ON public.certificado_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.certificado_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj text NOT NULL UNIQUE,
  razao_social text,
  nome_fantasia text,
  telefones jsonb NOT NULL DEFAULT '[]'::jsonb,
  telefone_principal text,
  email text,
  cnae text,
  cnae_descricao text,
  uf text,
  municipio text,
  porte text,
  mei boolean,
  data_abertura date,
  dias_desde_abertura int,
  origem_janela int,
  situacao text NOT NULL DEFAULT 'novo',
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.certificado_leads TO authenticated;
GRANT ALL ON public.certificado_leads TO service_role;
ALTER TABLE public.certificado_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cert_leads_admin_all" ON public.certificado_leads FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_cert_leads_uf ON public.certificado_leads (uf);
CREATE INDEX idx_cert_leads_data_abertura ON public.certificado_leads (data_abertura DESC);
CREATE INDEX idx_cert_leads_janela ON public.certificado_leads (origem_janela);
CREATE INDEX idx_cert_leads_situacao ON public.certificado_leads (situacao);
CREATE INDEX idx_cert_leads_created ON public.certificado_leads (created_at DESC);

CREATE TABLE public.certificado_coleta_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  janela int,
  data_referencia date,
  encontrados int NOT NULL DEFAULT 0,
  novos int NOT NULL DEFAULT 0,
  duplicados int NOT NULL DEFAULT 0,
  sem_telefone int NOT NULL DEFAULT 0,
  erro text,
  manual boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.certificado_coleta_log TO authenticated;
GRANT ALL ON public.certificado_coleta_log TO service_role;
ALTER TABLE public.certificado_coleta_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cert_log_admin_all" ON public.certificado_coleta_log FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_cert_log_created ON public.certificado_coleta_log (created_at DESC);

INSERT INTO public.certificado_config (motor_ativo) VALUES (false);