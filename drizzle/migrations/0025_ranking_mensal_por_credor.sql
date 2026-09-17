CREATE OR REPLACE FUNCTION public.ranking_mensal_por_credor(p_mes_ano text DEFAULT NULL::text)
RETURNS TABLE(
  user_id uuid,
  nome text,
  novo_mundo_recebido numeric,
  ume_recebido numeric,
  total_recebido numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_mes_ano text;
BEGIN
  v_mes_ano := COALESCE(p_mes_ano, to_char(NOW() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM'));

  RETURN QUERY
  SELECT
    p.id AS user_id,
    p.nome,
    COALESCE(SUM(pg.valor_parcela) FILTER (WHERE a.empresa = 'ume_novo_mundo'), 0) AS novo_mundo_recebido,
    COALESCE(SUM(pg.valor_parcela) FILTER (WHERE a.empresa = 'mundo_da_moda'), 0) AS ume_recebido,
    COALESCE(SUM(pg.valor_parcela) FILTER (WHERE a.empresa IN ('ume_novo_mundo', 'mundo_da_moda')), 0) AS total_recebido
  FROM public.profiles p
  LEFT JOIN public.acordos a ON a.user_id = p.id
  LEFT JOIN public.pagamentos pg ON pg.acordo_id = a.id
    AND pg.status = 'pago'
    AND pg.data_paga >= (v_mes_ano || '-01')::date
    AND pg.data_paga < ((v_mes_ano || '-01')::date + interval '1 month')
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.user_permissions up
    WHERE up.user_id = p.id
      AND up.visivel_ranking = false
  )
  GROUP BY p.id, p.nome
  ORDER BY total_recebido DESC;
END;
$function$;

REVOKE ALL ON FUNCTION public.ranking_mensal_por_credor(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ranking_mensal_por_credor(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ranking_mensal_por_credor(text) TO service_role;