
-- 1. Fix mutable search_path on master_tenant_id
CREATE OR REPLACE FUNCTION public.master_tenant_id()
RETURNS uuid
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT '00000000-0000-0000-0000-000000000001'::uuid
$$;

-- 2. estrategia_importacao: restrict broad SELECT
DROP POLICY IF EXISTS "Todos autenticados podem ver importações" ON public.estrategia_importacao;
CREATE POLICY "Acesso estrategias pode ver importacoes"
  ON public.estrategia_importacao
  FOR SELECT
  TO authenticated
  USING (public.has_estrategias_access(auth.uid()));

-- 3. whatsapp_aquecimento_grupos: admin-only SELECT
DROP POLICY IF EXISTS "Auth pode ler grupos aquecimento" ON public.whatsapp_aquecimento_grupos;
CREATE POLICY "Admins leem grupos aquecimento"
  ON public.whatsapp_aquecimento_grupos
  FOR SELECT
  TO authenticated
  USING (public.is_admin_user(auth.uid()));

-- 4. whatsapp_aquecimento_grupo_membros: admin-only SELECT
DROP POLICY IF EXISTS "Auth pode ler membros grupo aquecimento" ON public.whatsapp_aquecimento_grupo_membros;
CREATE POLICY "Admins leem membros grupo aquecimento"
  ON public.whatsapp_aquecimento_grupo_membros
  FOR SELECT
  TO authenticated
  USING (public.is_admin_user(auth.uid()));

-- 5. whatsapp_aquecimento_grupo_conversas_log: admin-only SELECT
DROP POLICY IF EXISTS "Auth pode ler log conversa grupo" ON public.whatsapp_aquecimento_grupo_conversas_log;
CREATE POLICY "Admins leem log conversa grupo"
  ON public.whatsapp_aquecimento_grupo_conversas_log
  FOR SELECT
  TO authenticated
  USING (public.is_admin_user(auth.uid()));

-- 6. user_roles: prevent non-admin self-assignment via restrictive policies
CREATE POLICY "Somente admin pode inserir papeis"
  ON public.user_roles
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Somente admin pode atualizar papeis"
  ON public.user_roles
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Somente admin pode deletar papeis"
  ON public.user_roles
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
