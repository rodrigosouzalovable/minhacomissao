CREATE OR REPLACE FUNCTION public.meta_envios_resumo(_uid uuid DEFAULT NULL::uuid, _ate date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := COALESCE(_uid, auth.uid());
  v_ate date := COALESCE(_ate, CURRENT_DATE);
  v_ini7 date := v_ate - 6;
  v_unicos_hoje int := 0;
  v_unicos_7d int := 0;
  v_enviadas_hoje int := 0;
  v_por_instancia jsonb := '[]'::jsonb;
  v_serie jsonb := '[]'::jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'não autenticado';
  END IF;

  SELECT count(DISTINCT telefone), count(*)
    INTO v_unicos_hoje, v_enviadas_hoje
  FROM public.meta_whatsapp_envios_log
  WHERE user_id = v_uid
    AND (status IS NULL OR status <> 'failed')
    AND enviado_em::date = v_ate;

  SELECT count(DISTINCT telefone) INTO v_unicos_7d
  FROM public.meta_whatsapp_envios_log
  WHERE user_id = v_uid
    AND (status IS NULL OR status <> 'failed')
    AND enviado_em::date BETWEEN v_ini7 AND v_ate;

  SELECT coalesce(jsonb_agg(t), '[]'::jsonb) INTO v_por_instancia
  FROM (
    SELECT i.id, i.nome, i.display_phone,
           -- tier_diario efetivo: manual > saude_tier (Meta API) > fallback 250
           CASE
             WHEN UPPER(COALESCE(i.messaging_limit_manual, i.saude_tier, '')) LIKE '%UNLIMITED%' THEN 100000
             WHEN UPPER(COALESCE(i.messaging_limit_manual, i.saude_tier, '')) LIKE '%100K%'      THEN 100000
             WHEN UPPER(COALESCE(i.messaging_limit_manual, i.saude_tier, '')) LIKE '%10K%'       THEN 10000
             WHEN UPPER(COALESCE(i.messaging_limit_manual, i.saude_tier, '')) LIKE '%2K%'        THEN 2000
             WHEN UPPER(COALESCE(i.messaging_limit_manual, i.saude_tier, '')) LIKE '%1K%'        THEN 1000
             WHEN UPPER(COALESCE(i.messaging_limit_manual, i.saude_tier, '')) LIKE '%250%'       THEN 250
             WHEN UPPER(COALESCE(i.messaging_limit_manual, i.saude_tier, '')) LIKE '%50%'        THEN 50
             ELSE COALESCE(i.tier_diario, 250)
           END AS tier_diario,
           i.enviados_hoje,
           i.saude_quality, i.saude_tier, i.ativo,
           coalesce(c.qtd, 0) AS qtd_hoje,
           coalesce(c.unicos, 0) AS unicos_hoje
    FROM public.meta_whatsapp_instances i
    LEFT JOIN (
      SELECT instancia_id, count(*) AS qtd, count(DISTINCT telefone) AS unicos
      FROM public.meta_whatsapp_envios_log
      WHERE user_id = v_uid
        AND (status IS NULL OR status <> 'failed')
        AND enviado_em::date = v_ate
      GROUP BY instancia_id
    ) c ON c.instancia_id = i.id
    WHERE i.user_id = v_uid
    ORDER BY i.nome
  ) t;

  SELECT coalesce(jsonb_agg(jsonb_build_object('data', d, 'unicos', u, 'total', q) ORDER BY d), '[]'::jsonb)
    INTO v_serie
  FROM (
    SELECT enviado_em::date AS d,
           count(DISTINCT telefone) AS u,
           count(*) AS q
    FROM public.meta_whatsapp_envios_log
    WHERE user_id = v_uid
      AND (status IS NULL OR status <> 'failed')
      AND enviado_em::date BETWEEN v_ini7 AND v_ate
    GROUP BY enviado_em::date
  ) s;

  RETURN jsonb_build_object(
    'unicos_hoje', v_unicos_hoje,
    'unicos_7d', v_unicos_7d,
    'enviadas_hoje', v_enviadas_hoje,
    'por_instancia', v_por_instancia,
    'serie_7d', v_serie
  );
END;
$function$;