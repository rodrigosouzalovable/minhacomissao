CREATE OR REPLACE FUNCTION public.is_owner_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id = 'ee649720-b8ce-47a2-859e-100a3a9ae6bb'::uuid
    AND public.has_role(_user_id, 'admin'::public.app_role)
$$;

REVOKE ALL ON FUNCTION public.is_owner_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_owner_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_owner_admin(uuid) TO service_role;

DROP POLICY IF EXISTS "Admins gerenciam pedidos virtualsms" ON public.virtualsms_pedidos;
CREATE POLICY "Owner admin gerencia pedidos virtualsms"
ON public.virtualsms_pedidos
FOR ALL
TO authenticated
USING (public.is_owner_admin(auth.uid()))
WITH CHECK (public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins gerenciam config virtualsms" ON public.virtualsms_config;
CREATE POLICY "Owner admin gerencia config virtualsms"
ON public.virtualsms_config
FOR ALL
TO authenticated
USING (public.is_owner_admin(auth.uid()))
WITH CHECK (public.is_owner_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage relatorio config" ON public.relatorio_diario_config;
CREATE POLICY "Owner admin manages relatorio config"
ON public.relatorio_diario_config
FOR ALL
TO authenticated
USING (public.is_owner_admin(auth.uid()))
WITH CHECK (public.is_owner_admin(auth.uid()));