
-- Função auxiliar: verifica se o usuário tem permissão de Acordos Compartilhados
CREATE OR REPLACE FUNCTION public.has_acordos_compartilhados(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_permissions
    WHERE user_id = _user_id
      AND acordos_compartilhados = true
  )
$$;

-- Policy: visualizar todos os acordos
DROP POLICY IF EXISTS "Acordos compartilhados veem todos os acordos" ON public.acordos;
CREATE POLICY "Acordos compartilhados veem todos os acordos"
ON public.acordos
FOR SELECT
TO authenticated
USING (public.has_acordos_compartilhados(auth.uid()));

-- Policy: visualizar todos os pagamentos
DROP POLICY IF EXISTS "Acordos compartilhados veem todos os pagamentos" ON public.pagamentos;
CREATE POLICY "Acordos compartilhados veem todos os pagamentos"
ON public.pagamentos
FOR SELECT
TO authenticated
USING (public.has_acordos_compartilhados(auth.uid()));

-- Policy: visualizar todos os perfis (para nome do funcionário)
DROP POLICY IF EXISTS "Acordos compartilhados veem todos os perfis" ON public.profiles;
CREATE POLICY "Acordos compartilhados veem todos os perfis"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_acordos_compartilhados(auth.uid()));
