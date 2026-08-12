-- 1) can_view_* : remover comportamento "libera por padrão" quando não há registro em user_permissions
CREATE OR REPLACE FUNCTION public.can_view_credor(_user uuid, _credor text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT _user IS NOT NULL AND (
    public.has_role(_user, 'admin'::public.app_role)
    OR public.has_role(_user, 'gestor'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_id = _user
        AND (
          COALESCE(array_length(up.credores, 1), 0) = 0
          OR _credor = ANY(up.credores)
        )
    )
  )
$function$;

CREATE OR REPLACE FUNCTION public.can_view_devedor_cpf(_user uuid, _cpf text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT _user IS NOT NULL AND (
    public.has_role(_user, 'admin'::public.app_role)
    OR public.has_role(_user, 'gestor'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.devedores d
      WHERE public.cpf_normalize(d.cpf) = public.cpf_normalize(_cpf)
        AND public.can_view_credor(_user, d.credor)
    )
  )
$function$;

CREATE OR REPLACE FUNCTION public.can_view_devedor_id(_user uuid, _devedor_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT _user IS NOT NULL AND (
    public.has_role(_user, 'admin'::public.app_role)
    OR public.has_role(_user, 'gestor'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.devedores d
      WHERE d.id = _devedor_id
        AND public.can_view_credor(_user, d.credor)
    )
  )
$function$;

-- 2) credor_desconto_faixas: sem leitura anônima direta na tabela; portal usa RPC dedicada
DROP POLICY IF EXISTS "Faixas de desconto sao publicas para leitura" ON public.credor_desconto_faixas;

CREATE POLICY "Faixas de desconto legiveis por autenticados"
ON public.credor_desconto_faixas
FOR SELECT
TO authenticated
USING (true);

REVOKE SELECT ON public.credor_desconto_faixas FROM anon;

CREATE OR REPLACE FUNCTION public.portal_faixas_credor(_credor text)
RETURNS TABLE (dias_de integer, dias_ate integer, desc_avista numeric, desc_parcelado numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT f.dias_de, f.dias_ate, f.desc_avista, f.desc_parcelado
  FROM public.credor_desconto_faixas f
  WHERE _credor IS NOT NULL
    AND length(btrim(_credor)) > 0
    AND f.credor = upper(btrim(_credor))
  ORDER BY f.dias_de
$function$;

GRANT EXECUTE ON FUNCTION public.portal_faixas_credor(text) TO anon, authenticated;

-- 3) calendario de aquecimento: leitura apenas admin
DROP POLICY IF EXISTS "Authenticated leem calendario aquecimento" ON public.whatsapp_aquecimento_calendario;

CREATE POLICY "Admins leem calendario aquecimento"
ON public.whatsapp_aquecimento_calendario
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 4) meta_atendimento_estado: leitura escopada ao tenant
DROP POLICY IF EXISTS "estado_read_authenticated" ON public.meta_atendimento_estado;

CREATE POLICY "estado_read_tenant_members"
ON public.meta_atendimento_estado
FOR SELECT
TO authenticated
USING (
  public.is_admin_user(auth.uid())
  OR public.user_can_access_tenant(auth.uid(), tenant_id)
);

-- 5) qualificacoes: leitura apenas para quem participa das caixas do Inbox Meta
DROP POLICY IF EXISTS "qcx_select_auth" ON public.meta_qualificacao_caixa;

CREATE POLICY "qcx_select_inbox_members"
ON public.meta_qualificacao_caixa
FOR SELECT
TO authenticated
USING (public.has_any_meta_folder_access(auth.uid()));

DROP POLICY IF EXISTS "qualif_select_auth" ON public.meta_qualificacoes;

CREATE POLICY "qualif_select_inbox_members"
ON public.meta_qualificacoes
FOR SELECT
TO authenticated
USING (public.has_any_meta_folder_access(auth.uid()));

-- 6) relatorios de acionamentos: leitura apenas admin/gestor
DROP POLICY IF EXISTS "ra_select_authenticated" ON public.relatorio_acionamentos;

CREATE POLICY "ra_select_admin_gestor"
ON public.relatorio_acionamentos
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'gestor'::public.app_role)
);

DROP POLICY IF EXISTS "ra_meta_select_authenticated" ON public.relatorio_acionamentos_meta;

CREATE POLICY "ra_meta_select_admin_gestor"
ON public.relatorio_acionamentos_meta
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'gestor'::public.app_role)
);