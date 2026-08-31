-- 1) Clientes do parceiro Meta
CREATE TABLE IF NOT EXISTS public.meta_partner_clients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  documento text,
  responsavel_nome text,
  responsavel_email text,
  responsavel_telefone text,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_partner_clients TO authenticated;
GRANT ALL ON public.meta_partner_clients TO service_role;

ALTER TABLE public.meta_partner_clients ENABLE ROW LEVEL SECURITY;


-- 2) Vínculo usuário ↔ cliente do parceiro
CREATE TABLE IF NOT EXISTS public.meta_partner_client_users (
  cliente_id uuid NOT NULL REFERENCES public.meta_partner_clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  papel text NOT NULL DEFAULT 'operador' CHECK (papel IN ('admin_cliente', 'operador')),
  criado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (cliente_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_partner_client_users TO authenticated;
GRANT ALL ON public.meta_partner_client_users TO service_role;

ALTER TABLE public.meta_partner_client_users ENABLE ROW LEVEL SECURITY;


-- 3) Políticas de clientes (depois que ambas as tabelas existem)
CREATE POLICY "admin_gerencia_clientes_parceiro" ON public.meta_partner_clients
  FOR ALL TO authenticated
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

CREATE POLICY "usuario_ve_clientes_vinculados" ON public.meta_partner_clients
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.meta_partner_client_users u
      WHERE u.cliente_id = id AND u.user_id = auth.uid()
    )
  );

CREATE POLICY "admin_gerencia_vinculos_cliente" ON public.meta_partner_client_users
  FOR ALL TO authenticated
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

CREATE POLICY "usuario_ve_proprios_vinculos" ON public.meta_partner_client_users
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER meta_partner_clients_updated_at
  BEFORE UPDATE ON public.meta_partner_clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 4) Colunas de cliente nos ativos Meta
ALTER TABLE public.meta_business_managers
  ADD COLUMN IF NOT EXISTS partner_client_id uuid REFERENCES public.meta_partner_clients(id) ON DELETE SET NULL;

ALTER TABLE public.meta_whatsapp_instances
  ADD COLUMN IF NOT EXISTS partner_client_id uuid REFERENCES public.meta_partner_clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_meta_bm_partner_client ON public.meta_business_managers(partner_client_id);
CREATE INDEX IF NOT EXISTS idx_meta_instances_partner_client ON public.meta_whatsapp_instances(partner_client_id);


-- 5) Funções auxiliares de escopo por cliente do parceiro
CREATE OR REPLACE FUNCTION public.usuario_cliente_parceiro(_uid uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cliente_id
  FROM public.meta_partner_client_users
  WHERE user_id = _uid
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.pode_ver_cliente_parceiro(_uid uuid, _cliente_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin_user(_uid)
    OR EXISTS (
         SELECT 1 FROM public.meta_partner_client_users
         WHERE user_id = _uid AND cliente_id = _cliente_id
       )
$$;


-- 6) Atualiza políticas de meta_business_managers para respeitar cliente do parceiro
DROP POLICY IF EXISTS "meta_bm_cliente_parceiro_select" ON public.meta_business_managers;
CREATE POLICY "meta_bm_cliente_parceiro_select" ON public.meta_business_managers
  FOR SELECT TO authenticated
  USING (
    partner_client_id IS NULL
    OR public.is_admin_user(auth.uid())
    OR public.pode_ver_cliente_parceiro(auth.uid(), partner_client_id)
  );

DROP POLICY IF EXISTS "meta_bm_cliente_parceiro_update" ON public.meta_business_managers;
CREATE POLICY "meta_bm_cliente_parceiro_update" ON public.meta_business_managers
  FOR UPDATE TO authenticated
  USING (
    partner_client_id IS NULL
    OR public.is_admin_user(auth.uid())
    OR public.pode_ver_cliente_parceiro(auth.uid(), partner_client_id)
  )
  WITH CHECK (
    partner_client_id IS NULL
    OR public.is_admin_user(auth.uid())
    OR public.pode_ver_cliente_parceiro(auth.uid(), partner_client_id)
  );


-- 7) Atualiza políticas de meta_whatsapp_instances para respeitar cliente do parceiro
DROP POLICY IF EXISTS "meta_instances_cliente_parceiro_select" ON public.meta_whatsapp_instances;
CREATE POLICY "meta_instances_cliente_parceiro_select" ON public.meta_whatsapp_instances
  FOR SELECT TO authenticated
  USING (
    partner_client_id IS NULL
    OR public.is_admin_user(auth.uid())
    OR public.pode_ver_cliente_parceiro(auth.uid(), partner_client_id)
  );

DROP POLICY IF EXISTS "meta_instances_cliente_parceiro_update" ON public.meta_whatsapp_instances;
CREATE POLICY "meta_instances_cliente_parceiro_update" ON public.meta_whatsapp_instances
  FOR UPDATE TO authenticated
  USING (
    partner_client_id IS NULL
    OR public.is_admin_user(auth.uid())
    OR public.pode_ver_cliente_parceiro(auth.uid(), partner_client_id)
  )
  WITH CHECK (
    partner_client_id IS NULL
    OR public.is_admin_user(auth.uid())
    OR public.pode_ver_cliente_parceiro(auth.uid(), partner_client_id)
  );


-- 8) Propaga visibilidade por cliente do parceiro em tabelas relacionadas
DROP POLICY IF EXISTS "meta_templates_cliente_parceiro_select" ON public.meta_whatsapp_templates;
CREATE POLICY "meta_templates_cliente_parceiro_select" ON public.meta_whatsapp_templates
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.meta_whatsapp_instances i
      WHERE i.id = instancia_id
        AND (
          i.partner_client_id IS NULL
          OR public.is_admin_user(auth.uid())
          OR public.pode_ver_cliente_parceiro(auth.uid(), i.partner_client_id)
        )
    )
  );

DROP POLICY IF EXISTS "meta_envios_log_cliente_parceiro_select" ON public.meta_whatsapp_envios_log;
CREATE POLICY "meta_envios_log_cliente_parceiro_select" ON public.meta_whatsapp_envios_log
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_admin_user(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.meta_whatsapp_instances i
      WHERE i.id = instancia_id
        AND i.partner_client_id IS NOT NULL
        AND public.pode_ver_cliente_parceiro(auth.uid(), i.partner_client_id)
    )
  );

DROP POLICY IF EXISTS "meta_mensagens_cliente_parceiro_select" ON public.meta_whatsapp_mensagens;
CREATE POLICY "meta_mensagens_cliente_parceiro_select" ON public.meta_whatsapp_mensagens
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.meta_whatsapp_instances i
      WHERE i.id = instancia_id
        AND (
          i.partner_client_id IS NULL
          OR public.is_admin_user(auth.uid())
          OR public.pode_ver_cliente_parceiro(auth.uid(), i.partner_client_id)
        )
    )
  );