CREATE OR REPLACE FUNCTION public.consulta_cpf_stats_7d()
RETURNS TABLE(dia date, total integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (created_at AT TIME ZONE 'America/Sao_Paulo')::date AS dia,
         count(*)::int AS total
  FROM public.consulta_cpf_notificacoes
  WHERE created_at >= (now() - interval '7 days')
    AND (
      public.has_role(auth.uid(), 'admin')
      OR assigned_user_id = auth.uid()
    )
  GROUP BY 1
  ORDER BY 1 DESC
$$;

GRANT EXECUTE ON FUNCTION public.consulta_cpf_stats_7d() TO authenticated;

CREATE OR REPLACE FUNCTION public.consulta_cpf_nao_lidas()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::int
  FROM public.consulta_cpf_notificacoes
  WHERE lida_em IS NULL
    AND (
      public.has_role(auth.uid(), 'admin')
      OR assigned_user_id = auth.uid()
    )
$$;

GRANT EXECUTE ON FUNCTION public.consulta_cpf_nao_lidas() TO authenticated;