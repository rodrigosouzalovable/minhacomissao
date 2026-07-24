
-- 1) chatbot_config & related: restrict broad authenticated SELECT to admin/gestor
DROP POLICY IF EXISTS "Authenticated can read chatbot config" ON public.chatbot_config;
CREATE POLICY "Admin/gestor read chatbot config" ON public.chatbot_config
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gestor'::app_role));

DROP POLICY IF EXISTS "Authenticated can read templates" ON public.chatbot_templates;
CREATE POLICY "Admin/gestor read chatbot templates" ON public.chatbot_templates
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gestor'::app_role));

DROP POLICY IF EXISTS "Authenticated read system_config" ON public.system_config;
CREATE POLICY "Admin read system_config" ON public.system_config
  FOR SELECT TO authenticated
  USING (is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Authenticated read system_settings" ON public.system_settings;
CREATE POLICY "Admin/gestor read system_settings" ON public.system_settings
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gestor'::app_role));

-- meta_billing_*: drop redundant broad SELECT (tenant_scope_all remains)
DROP POLICY IF EXISTS "authenticated can read guardrail" ON public.meta_billing_guardrail;
DROP POLICY IF EXISTS "authenticated read meta mensal" ON public.meta_billing_meta_mensal;
DROP POLICY IF EXISTS "authenticated read meta billing report config" ON public.meta_billing_relatorio_config;

-- 2) estrategia_cliente: harden reservado_por assignment via trigger.
-- Non-admin users are prevented from ever assigning a reservado_por
-- other than their own uid, and from stealing a row already reserved to another user.
CREATE OR REPLACE FUNCTION public.enforce_estrategia_reserva()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF is_admin_user(auth.uid()) THEN
    RETURN NEW;
  END IF;
  -- Only allow claiming rows that are currently NULL and only for self
  IF TG_OP = 'UPDATE' THEN
    IF NEW.reservado_por IS DISTINCT FROM OLD.reservado_por THEN
      IF OLD.reservado_por IS NOT NULL THEN
        RAISE EXCEPTION 'CPF já reservado por outro usuário';
      END IF;
      IF NEW.reservado_por IS NOT NULL AND NEW.reservado_por <> auth.uid() THEN
        RAISE EXCEPTION 'Não é permitido reservar CPF para outro usuário';
      END IF;
    END IF;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.reservado_por IS NOT NULL AND NEW.reservado_por <> auth.uid() THEN
      RAISE EXCEPTION 'Não é permitido inserir reserva para outro usuário';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_estrategia_reserva ON public.estrategia_cliente;
CREATE TRIGGER trg_enforce_estrategia_reserva
  BEFORE INSERT OR UPDATE ON public.estrategia_cliente
  FOR EACH ROW EXECUTE FUNCTION public.enforce_estrategia_reserva();

-- 3) meta_whatsapp_templates: drop the broad utility SELECT policy.
-- Ownership ("Users manage templates of own instances") and tenant_scope_all remain.
DROP POLICY IF EXISTS "Authenticated users can view approved utility meta templates fo" ON public.meta_whatsapp_templates;
DROP POLICY IF EXISTS "Authenticated users can view approved utility meta templates for their instances" ON public.meta_whatsapp_templates;
