CREATE OR REPLACE FUNCTION public.ranking_mensal_por_credor_v2(p_mes_ano text DEFAULT NULL::text)
RETURNS TABLE(user_id uuid, nome text, novo_mundo_recebido numeric, ume_recebido numeric, odres_cred_recebido numeric, total_recebido numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_mes_ano text;
BEGIN
  IF auth.uid() IS NULL AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Faça login para consultar os recebimentos.' USING ERRCODE = '42501';
  END IF;
  v_mes_ano := COALESCE(p_mes_ano, to_char(NOW() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM'));
  IF v_mes_ano !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN
    RAISE EXCEPTION 'Mês inválido.' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  SELECT p.id, p.nome,
    COALESCE(SUM(pg.valor_parcela) FILTER (WHERE a.empresa = 'ume_novo_mundo'), 0),
    COALESCE(SUM(pg.valor_parcela) FILTER (WHERE a.empresa = 'mundo_da_moda'), 0),
    COALESCE(SUM(pg.valor_parcela) FILTER (WHERE a.empresa = 'odres_cred'), 0),
    COALESCE(SUM(pg.valor_parcela) FILTER (WHERE a.empresa IN ('ume_novo_mundo', 'mundo_da_moda', 'odres_cred')), 0)
  FROM public.profiles p
  LEFT JOIN public.acordos a ON a.user_id = p.id
  LEFT JOIN public.pagamentos pg ON pg.acordo_id = a.id
    AND pg.status = 'pago'
    AND pg.data_paga >= (v_mes_ano || '-01')::date
    AND pg.data_paga < ((v_mes_ano || '-01')::date + interval '1 month')
  WHERE NOT EXISTS (SELECT 1 FROM public.user_permissions up WHERE up.user_id = p.id AND up.visivel_ranking = false)
  GROUP BY p.id, p.nome
  ORDER BY 6 DESC, p.id;
END;
$function$;
REVOKE ALL ON FUNCTION public.ranking_mensal_por_credor_v2(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ranking_mensal_por_credor_v2(text) TO authenticated, service_role;
COMMENT ON FUNCTION public.ranking_mensal_por_credor(text) IS 'DEPRECATED: dashboard consumers use ranking_mensal_por_credor_v2, including Odres Cred. Retained for deployed client compatibility.';