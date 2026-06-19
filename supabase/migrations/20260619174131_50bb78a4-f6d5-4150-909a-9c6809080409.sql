
-- 1. meta_whatsapp_instances
CREATE TABLE public.meta_whatsapp_instances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  phone_number_id TEXT NOT NULL,
  waba_id TEXT NOT NULL,
  business_id TEXT,
  display_phone TEXT,
  access_token TEXT NOT NULL,
  webhook_verify_token TEXT,
  tier_diario INTEGER NOT NULL DEFAULT 250,
  enviados_hoje INTEGER NOT NULL DEFAULT 0,
  ultimo_reset DATE NOT NULL DEFAULT CURRENT_DATE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (phone_number_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_whatsapp_instances TO authenticated;
GRANT ALL ON public.meta_whatsapp_instances TO service_role;
ALTER TABLE public.meta_whatsapp_instances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own meta instances" ON public.meta_whatsapp_instances
  FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- 2. meta_whatsapp_templates
CREATE TABLE public.meta_whatsapp_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instancia_id UUID NOT NULL REFERENCES public.meta_whatsapp_instances(id) ON DELETE CASCADE,
  nome_template TEXT NOT NULL,
  categoria TEXT,
  idioma TEXT NOT NULL DEFAULT 'pt_BR',
  status TEXT NOT NULL DEFAULT 'pending',
  body_text TEXT,
  variaveis JSONB NOT NULL DEFAULT '{}'::jsonb,
  sincronizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (instancia_id, nome_template, idioma)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_whatsapp_templates TO authenticated;
GRANT ALL ON public.meta_whatsapp_templates TO service_role;
ALTER TABLE public.meta_whatsapp_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage templates of own instances" ON public.meta_whatsapp_templates
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.meta_whatsapp_instances i
            WHERE i.id = instancia_id
              AND (i.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.meta_whatsapp_instances i
            WHERE i.id = instancia_id
              AND (i.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
  );

-- 3. meta_whatsapp_envios_log
CREATE TABLE public.meta_whatsapp_envios_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instancia_id UUID NOT NULL REFERENCES public.meta_whatsapp_instances(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  telefone TEXT NOT NULL,
  template_nome TEXT,
  status TEXT NOT NULL DEFAULT 'sent',
  wa_message_id TEXT,
  erro TEXT,
  enviado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_meta_envios_user_date ON public.meta_whatsapp_envios_log (user_id, enviado_em DESC);
CREATE INDEX idx_meta_envios_instancia_date ON public.meta_whatsapp_envios_log (instancia_id, enviado_em DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_whatsapp_envios_log TO authenticated;
GRANT ALL ON public.meta_whatsapp_envios_log TO service_role;
ALTER TABLE public.meta_whatsapp_envios_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own meta send log" ON public.meta_whatsapp_envios_log
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own meta send log" ON public.meta_whatsapp_envios_log
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 4. provedor column on whatsapp_mensagens
ALTER TABLE public.whatsapp_mensagens
  ADD COLUMN IF NOT EXISTS provedor TEXT NOT NULL DEFAULT 'uazapi';
