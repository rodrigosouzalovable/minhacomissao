ALTER TABLE public.certificado_prospeccao_envios
  ADD COLUMN IF NOT EXISTS job_id uuid REFERENCES public.envio_meta_job(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS job_item_id uuid REFERENCES public.envio_meta_job_item(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS entregue_em timestamptz,
  ADD COLUMN IF NOT EXISTS lido_em timestamptz,
  ADD COLUMN IF NOT EXISTS respondido_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_cert_envios_job ON public.certificado_prospeccao_envios(job_id);
CREATE INDEX IF NOT EXISTS idx_cert_envios_wamid ON public.certificado_prospeccao_envios(wa_message_id) WHERE wa_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cert_leads_phone_suffix ON public.certificado_leads (right(regexp_replace(coalesce(telefone_principal,''),'\D','','g'),8));

CREATE TABLE public.clara_config (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  folder_id uuid NOT NULL REFERENCES public.meta_inbox_folders(id) ON DELETE RESTRICT,
  ativo boolean NOT NULL DEFAULT true,
  mensagem_agendar text NOT NULL,
  mensagem_documentos text NOT NULL,
  mensagem_recebido text NOT NULL DEFAULT 'Recebi seus dados e documentos. Obrigada! Vou encaminhar seu atendimento para nossa equipe concluir o agendamento.',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clara_config TO authenticated;
GRANT ALL ON public.clara_config TO service_role;
ALTER TABLE public.clara_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clara_config_admin_all" ON public.clara_config FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.clara_conversa_estado (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contato_id uuid NOT NULL UNIQUE REFERENCES public.meta_whatsapp_contatos(id) ON DELETE CASCADE,
  telefone text NOT NULL DEFAULT '',
  etapa text NOT NULL DEFAULT 'novo',
  contexto jsonb NOT NULL DEFAULT '{}'::jsonb,
  aguardando_humano boolean NOT NULL DEFAULT false,
  optout boolean NOT NULL DEFAULT false,
  ultima_resposta_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clara_conversa_estado TO authenticated;
GRANT ALL ON public.clara_conversa_estado TO service_role;
ALTER TABLE public.clara_conversa_estado ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clara_estado_admin_all" ON public.clara_conversa_estado FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX idx_clara_estado_telefone ON public.clara_conversa_estado(right(regexp_replace(telefone,'\D','','g'),8));