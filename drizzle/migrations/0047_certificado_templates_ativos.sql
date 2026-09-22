CREATE TABLE public.certificado_prospeccao_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_mestre_id uuid NOT NULL REFERENCES public.meta_templates_mestre(id) ON DELETE CASCADE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_mestre_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.certificado_prospeccao_templates TO authenticated;
GRANT ALL ON public.certificado_prospeccao_templates TO service_role;

ALTER TABLE public.certificado_prospeccao_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam templates do certificado"
ON public.certificado_prospeccao_templates
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.certificado_prospeccao_templates (template_mestre_id, ativo)
SELECT id, true FROM public.meta_templates_mestre
ON CONFLICT (template_mestre_id) DO NOTHING;

CREATE INDEX certificado_prospeccao_templates_ativo_idx
ON public.certificado_prospeccao_templates (ativo, template_mestre_id);

CREATE INDEX IF NOT EXISTS meta_whatsapp_templates_aprovacao_lookup_idx
ON public.meta_whatsapp_templates (nome_template, idioma, status, instancia_id);

COMMENT ON TABLE public.certificado_prospeccao_templates IS 'Disponibilidade local dos templates na prospeccao de Certificado Digital; nao altera o template mestre nem outros fluxos.';