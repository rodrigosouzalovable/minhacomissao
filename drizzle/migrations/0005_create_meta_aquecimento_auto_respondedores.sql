CREATE TABLE public.meta_aquecimento_auto_respondedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone_normalizado text NOT NULL UNIQUE,
  telefone text NOT NULL,
  lead_id uuid NULL,
  nome text NULL,
  nicho text NULL,
  cidade text NULL,
  primeira_deteccao_em timestamptz NOT NULL DEFAULT now(),
  ultima_deteccao_em timestamptz NOT NULL DEFAULT now(),
  quantidade_respostas integer NOT NULL DEFAULT 1,
  ultima_resposta text NULL,
  motivo_classificacao text NOT NULL,
  confianca integer NOT NULL DEFAULT 0,
  instancia_id uuid NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meta_aquecimento_auto_respondedores_confianca_check CHECK (confianca >= 0 AND confianca <= 100),
  CONSTRAINT meta_aquecimento_auto_respondedores_quantidade_check CHECK (quantidade_respostas >= 1)
);

GRANT SELECT ON public.meta_aquecimento_auto_respondedores TO authenticated;
GRANT ALL ON public.meta_aquecimento_auto_respondedores TO service_role;

ALTER TABLE public.meta_aquecimento_auto_respondedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aq_auto_respondedores_admin_select"
ON public.meta_aquecimento_auto_respondedores
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX meta_aq_auto_resp_ultima_idx
ON public.meta_aquecimento_auto_respondedores (ultima_deteccao_em DESC);

CREATE INDEX meta_aq_auto_resp_nicho_cidade_idx
ON public.meta_aquecimento_auto_respondedores (nicho, cidade);