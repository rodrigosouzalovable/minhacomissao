
-- ============================================================
-- Fase 1: Multi-tenant foundation for Meta tables
-- ============================================================

-- 1. Tenants table
CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.tenants TO authenticated;
GRANT ALL ON public.tenants TO service_role;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- 2. Tenant members table
CREATE TABLE public.tenant_members (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role_tenant text NOT NULL DEFAULT 'member',
  criado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id)
);

GRANT SELECT ON public.tenant_members TO authenticated;
GRANT ALL ON public.tenant_members TO service_role;
ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_tenant_members_user ON public.tenant_members(user_id);

-- 3. Helper functions (created BEFORE policies that reference them)
CREATE OR REPLACE FUNCTION public.master_tenant_id()
RETURNS uuid
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT '00000000-0000-0000-0000-000000000001'::uuid
$$;

CREATE OR REPLACE FUNCTION public.user_can_access_tenant(_uid uuid, _tenant uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _uid IS NOT NULL AND (
    public.is_admin_user(_uid)
    OR EXISTS (
      SELECT 1 FROM public.tenant_members
      WHERE tenant_id = _tenant AND user_id = _uid
    )
  )
$$;

CREATE OR REPLACE FUNCTION public.user_tenants(_uid uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.tenant_members WHERE user_id = _uid
$$;

-- 4. Policies for tenants + tenant_members
CREATE POLICY "tenants_select_admin_or_member" ON public.tenants
  FOR SELECT TO authenticated
  USING (
    public.is_admin_user(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.tenant_members
      WHERE tenant_id = tenants.id AND user_id = auth.uid()
    )
  );

CREATE POLICY "tenants_admin_manage" ON public.tenants
  FOR ALL TO authenticated
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

CREATE POLICY "tenant_members_select_self_or_admin" ON public.tenant_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_user(auth.uid()));

CREATE POLICY "tenant_members_admin_manage" ON public.tenant_members
  FOR ALL TO authenticated
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

-- 5. Seed tenants (fixed UUIDs so app code can reference master reliably)
INSERT INTO public.tenants (id, slug, nome) VALUES
  ('00000000-0000-0000-0000-000000000001', 'master', 'Meus Acordos (Master)'),
  ('00000000-0000-0000-0000-000000000002', 'avatusbarbearia', 'Avatus Barbearia');

-- 6. Register existing admins as owners of master tenant
INSERT INTO public.tenant_members (tenant_id, user_id, role_tenant)
SELECT '00000000-0000-0000-0000-000000000001'::uuid, ur.user_id, 'owner'
FROM public.user_roles ur
WHERE ur.role = 'admin'
ON CONFLICT DO NOTHING;

-- 7. Add tenant_id column + index + tenant-scope policy to every Meta table
DO $$
DECLARE
  t text;
  meta_tables text[] := ARRAY[
    'meta_whatsapp_instances','meta_whatsapp_contatos','meta_whatsapp_mensagens',
    'meta_whatsapp_contato_etiquetas','meta_whatsapp_etiquetas','meta_whatsapp_envios_log',
    'meta_whatsapp_templates','meta_templates_instancia','meta_templates_mestre',
    'meta_envios_fila','envio_meta_job','envio_meta_job_item',
    'meta_campanha_agendada','meta_campanha_item','meta_instance_pagamentos',
    'meta_billing_snapshot','meta_billing_meta_mensal','meta_billing_alerts',
    'meta_billing_guardrail','meta_billing_relatorio_config',
    'meta_lembrete_config','meta_lembrete_log','meta_atendimento_fila',
    'meta_atendimento_estado','meta_business_managers','meta_envio_pool_config',
    'meta_whatsapp_config','meta_instance_daily_metrics','meta_templates_lote_log',
    'meta_aquecimento_pares','meta_whatsapp_mensagens_rapidas','meta_envios_meta_diaria'
  ];
BEGIN
  FOREACH t IN ARRAY meta_tables LOOP
    -- Add column with default = master tenant (backfills existing rows)
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS tenant_id uuid NOT NULL DEFAULT %L',
      t, '00000000-0000-0000-0000-000000000001'
    );
    -- Index for tenant filtering
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I(tenant_id)',
      'idx_' || t || '_tenant_id', t
    );
    -- Additive RLS policy: tenant members can access their tenant's rows.
    -- Existing admin/user policies remain untouched (permissive policies are OR-ed).
    EXECUTE format('DROP POLICY IF EXISTS "tenant_scope_all" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "tenant_scope_all" ON public.%I FOR ALL TO authenticated USING (public.user_can_access_tenant(auth.uid(), tenant_id)) WITH CHECK (public.user_can_access_tenant(auth.uid(), tenant_id))',
      t
    );
  END LOOP;
END $$;
