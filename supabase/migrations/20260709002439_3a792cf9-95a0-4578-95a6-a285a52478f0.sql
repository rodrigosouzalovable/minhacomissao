
-- ============= meta_templates_mestre =============
CREATE TABLE public.meta_templates_mestre (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL CHECK (categoria IN ('UTILITY','MARKETING','AUTHENTICATION')),
  idioma TEXT NOT NULL DEFAULT 'pt_BR',
  corpo TEXT NOT NULL,
  cabecalho_tipo TEXT CHECK (cabecalho_tipo IN ('TEXT','IMAGE','DOCUMENT','VIDEO')),
  cabecalho_texto TEXT,
  rodape TEXT,
  botoes JSONB NOT NULL DEFAULT '[]'::jsonb,
  exemplo JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_por UUID REFERENCES auth.users(id),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (nome, idioma)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_templates_mestre TO authenticated;
GRANT ALL ON public.meta_templates_mestre TO service_role;

ALTER TABLE public.meta_templates_mestre ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam templates mestre"
  ON public.meta_templates_mestre FOR ALL
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

CREATE TRIGGER trg_meta_templates_mestre_updated
  BEFORE UPDATE ON public.meta_templates_mestre
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= meta_templates_instancia =============
CREATE TABLE public.meta_templates_instancia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_mestre_id UUID NOT NULL REFERENCES public.meta_templates_mestre(id) ON DELETE CASCADE,
  instancia_id UUID NOT NULL REFERENCES public.meta_whatsapp_instances(id) ON DELETE CASCADE,
  waba_id TEXT,
  phone_number_id TEXT,
  meta_template_id TEXT,
  status TEXT NOT NULL DEFAULT 'PENDENTE'
    CHECK (status IN ('PENDENTE','ENVIADO','PENDING','APPROVED','REJECTED','PAUSED','DISABLED','FALHA_ENVIO')),
  erro TEXT,
  motivo_rejeicao TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (template_mestre_id, instancia_id)
);

CREATE INDEX idx_meta_templates_inst_status ON public.meta_templates_instancia(status);
CREATE INDEX idx_meta_templates_inst_mestre ON public.meta_templates_instancia(template_mestre_id);
CREATE INDEX idx_meta_templates_inst_waba ON public.meta_templates_instancia(waba_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_templates_instancia TO authenticated;
GRANT ALL ON public.meta_templates_instancia TO service_role;

ALTER TABLE public.meta_templates_instancia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam templates por instancia"
  ON public.meta_templates_instancia FOR ALL
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

CREATE TRIGGER trg_meta_templates_instancia_updated
  BEFORE UPDATE ON public.meta_templates_instancia
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= meta_templates_lote_log =============
CREATE TABLE public.meta_templates_lote_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_mestre_id UUID REFERENCES public.meta_templates_mestre(id) ON DELETE SET NULL,
  usuario_id UUID REFERENCES auth.users(id),
  total_instancias INTEGER NOT NULL DEFAULT 0,
  sucessos INTEGER NOT NULL DEFAULT 0,
  falhas INTEGER NOT NULL DEFAULT 0,
  detalhes JSONB NOT NULL DEFAULT '[]'::jsonb,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_templates_lote_log TO authenticated;
GRANT ALL ON public.meta_templates_lote_log TO service_role;

ALTER TABLE public.meta_templates_lote_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins veem logs de lote"
  ON public.meta_templates_lote_log FOR ALL
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));
