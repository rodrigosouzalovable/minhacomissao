CREATE OR REPLACE FUNCTION public.resumo_aquecimento_leads_campanhas()
RETURNS TABLE(dia date, tentativas bigint, enviados bigint, falhas bigint, instancias bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT l.dia, count(*)::bigint, count(*) FILTER (WHERE l.status = 'enviado')::bigint,
         count(*) FILTER (WHERE l.status = 'falha')::bigint, count(DISTINCT l.instancia_id)::bigint
  FROM public.meta_aquecimento_destino_log l
  WHERE public.has_role(auth.uid(), 'admin'::public.app_role)
    AND l.fonte = 'lead'
    AND l.dia >= ((now() AT TIME ZONE 'America/Sao_Paulo')::date - 13)
  GROUP BY l.dia ORDER BY l.dia DESC;
$$;
REVOKE ALL ON FUNCTION public.resumo_aquecimento_leads_campanhas() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resumo_aquecimento_leads_campanhas() TO authenticated;