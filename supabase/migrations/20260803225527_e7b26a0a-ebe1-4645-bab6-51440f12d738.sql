CREATE OR REPLACE FUNCTION public.listar_usuarios_ativos()
RETURNS TABLE(user_id uuid, nome text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id AS user_id, COALESCE(NULLIF(p.nome, ''), p.email) AS nome
  FROM public.profiles p
  WHERE p.ativo IS TRUE
  ORDER BY 2
$$;

REVOKE ALL ON FUNCTION public.listar_usuarios_ativos() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.listar_usuarios_ativos() FROM anon;
GRANT EXECUTE ON FUNCTION public.listar_usuarios_ativos() TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_usuarios_ativos() TO service_role;