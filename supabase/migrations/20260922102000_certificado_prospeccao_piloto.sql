ALTER TABLE public.certificado_config
  ADD COLUMN IF NOT EXISTS prospeccao_ativa boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS meta_bm_id uuid REFERENCES public.meta_business_managers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS template_nome text,
  ADD COLUMN IF NOT EXISTS template_idioma text NOT NULL DEFAULT 'pt_BR',
  ADD COLUMN IF NOT EXISTS limite_diario integer NOT NULL DEFAULT 50 CHECK (limite_diario BETWEEN 1 AND 500),
  ADD COLUMN IF NOT EXISTS ultimo_rr_indice integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prospeccao_pausada_motivo text,
  ADD COLUMN IF NOT EXISTS prospeccao_ultima_execucao timestamptz;
ALTER TABLE public.certificado_leads
  ADD COLUMN IF NOT EXISTS whatsapp_status text NOT NULL DEFAULT 'pendente' CHECK (whatsapp_status IN ('pendente','com_whatsapp','sem_whatsapp','nao_verificado','erro_temporario')),
  ADD COLUMN IF NOT EXISTS whatsapp_verificado_em timestamptz,
  ADD COLUMN IF NOT EXISTS whatsapp_instancia_id uuid REFERENCES public.user_whatsapp_instances(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_cert_leads_whatsapp_status ON public.certificado_leads (whatsapp_status, created_at DESC);
CREATE TABLE IF NOT EXISTS public.certificado_uazapi_verificadoras (
  instancia_id uuid PRIMARY KEY REFERENCES public.user_whatsapp_instances(id) ON DELETE CASCADE,
  ativa boolean NOT NULL DEFAULT true,
  selecionada_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.certificado_uazapi_verificadoras TO authenticated;
GRANT ALL ON public.certificado_uazapi_verificadoras TO service_role;
ALTER TABLE public.certificado_uazapi_verificadoras ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cert_uazapi_admin_all" ON public.certificado_uazapi_verificadoras;
CREATE POLICY "cert_uazapi_admin_all" ON public.certificado_uazapi_verificadoras FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TABLE IF NOT EXISTS public.certificado_prospeccao_envios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), lead_id uuid NOT NULL REFERENCES public.certificado_leads(id) ON DELETE CASCADE,
  bm_id uuid NOT NULL REFERENCES public.meta_business_managers(id) ON DELETE RESTRICT,
  instancia_id uuid REFERENCES public.meta_whatsapp_instances(id) ON DELETE SET NULL,
  template_nome text NOT NULL, template_idioma text NOT NULL DEFAULT 'pt_BR',
  status text NOT NULL DEFAULT 'reservado' CHECK (status IN ('reservado','enviado','entregue','lido','respondido','falha','suprimido')),
  wa_message_id text, erro text, reservado_em timestamptz NOT NULL DEFAULT now(), enviado_em timestamptz, updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (lead_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.certificado_prospeccao_envios TO authenticated;
GRANT ALL ON public.certificado_prospeccao_envios TO service_role;
ALTER TABLE public.certificado_prospeccao_envios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cert_envios_admin_all" ON public.certificado_prospeccao_envios;
CREATE POLICY "cert_envios_admin_all" ON public.certificado_prospeccao_envios FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX IF NOT EXISTS idx_cert_envios_bm_data ON public.certificado_prospeccao_envios (bm_id, reservado_em DESC);
CREATE INDEX IF NOT EXISTS idx_cert_envios_status ON public.certificado_prospeccao_envios (status, reservado_em DESC);
CREATE OR REPLACE FUNCTION public.definir_certificado_uazapi_verificadora(p_instancia_id uuid, p_ativa boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Acesso permitido apenas para administradores'; END IF;
 INSERT INTO public.certificado_uazapi_verificadoras(instancia_id,ativa,selecionada_por,updated_at) VALUES(p_instancia_id,p_ativa,auth.uid(),now())
 ON CONFLICT(instancia_id) DO UPDATE SET ativa=excluded.ativa,selecionada_por=auth.uid(),updated_at=now();
END; $$;
REVOKE ALL ON FUNCTION public.definir_certificado_uazapi_verificadora(uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.definir_certificado_uazapi_verificadora(uuid,boolean) TO authenticated, service_role;
