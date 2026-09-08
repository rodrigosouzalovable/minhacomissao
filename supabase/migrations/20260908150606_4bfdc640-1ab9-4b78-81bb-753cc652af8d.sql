CREATE TABLE public.meta_templates_onboarding_fila (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instancia_id uuid NOT NULL,
  template_mestre_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'PENDENTE',
  prioridade integer NOT NULL DEFAULT 0,
  tentativas integer NOT NULL DEFAULT 0,
  motivo text,
  agendado_para timestamptz NOT NULL DEFAULT now(),
  enviado_em timestamptz,
  finalizado_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instancia_id, template_mestre_id)
);

GRANT SELECT ON public.meta_templates_onboarding_fila TO authenticated;
GRANT ALL ON public.meta_templates_onboarding_fila TO service_role;
ALTER TABLE public.meta_templates_onboarding_fila ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins veem a fila de templates"
ON public.meta_templates_onboarding_fila FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_tpl_onb_fila_pendente ON public.meta_templates_onboarding_fila (status, agendado_para);
CREATE INDEX idx_tpl_onb_fila_inst ON public.meta_templates_onboarding_fila (instancia_id, status);

CREATE TABLE public.meta_templates_onboarding_config (
  id integer NOT NULL PRIMARY KEY DEFAULT 1,
  ativo boolean NOT NULL DEFAULT true,
  qtd_dia_1 integer NOT NULL DEFAULT 3,
  qtd_dia_2 integer NOT NULL DEFAULT 5,
  qtd_dia_3 integer NOT NULL DEFAULT 8,
  qtd_dia_padrao integer NOT NULL DEFAULT 10,
  intervalo_min_seg integer NOT NULL DEFAULT 900,
  intervalo_max_seg integer NOT NULL DEFAULT 1500,
  hora_inicio integer NOT NULL DEFAULT 9,
  hora_fim integer NOT NULL DEFAULT 18,
  max_rejeicoes_seguidas integer NOT NULL DEFAULT 2,
  criado_em timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meta_templates_onboarding_config_single CHECK (id = 1)
);

GRANT SELECT ON public.meta_templates_onboarding_config TO authenticated;
GRANT ALL ON public.meta_templates_onboarding_config TO service_role;
ALTER TABLE public.meta_templates_onboarding_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins veem a configuracao de copia de templates"
ON public.meta_templates_onboarding_config FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.meta_templates_onboarding_config (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE public.meta_whatsapp_instances
  ADD COLUMN IF NOT EXISTS templates_auto_copiar boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS templates_auto_status text,
  ADD COLUMN IF NOT EXISTS templates_auto_pausado_ate timestamptz,
  ADD COLUMN IF NOT EXISTS templates_auto_rejeicoes_seguidas integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS templates_auto_iniciado_em timestamptz;

CREATE TRIGGER update_tpl_onb_fila_updated_at
BEFORE UPDATE ON public.meta_templates_onboarding_fila
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tpl_onb_config_updated_at
BEFORE UPDATE ON public.meta_templates_onboarding_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();