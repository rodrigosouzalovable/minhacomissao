CREATE OR REPLACE FUNCTION public.comite_carteira_nm_kpis_extras(p_mes_ano text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_snap_id uuid;
  v_ini_mes timestamptz;
  v_fim_mes timestamptz;
  v_ini_30d timestamptz := now() - interval '30 days';
  v_result jsonb;
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'acesso negado';
  END IF;

  v_ini_mes := (p_mes_ano || '-01T00:00:00-03:00')::timestamptz;
  v_fim_mes := v_ini_mes + interval '1 month';

  SELECT id INTO v_snap_id
  FROM public.comite_carteira_nm_snapshot
  WHERE ativo = true
  ORDER BY importado_em DESC
  LIMIT 1;

  IF v_snap_id IS NULL THEN
    RETURN jsonb_build_object(
      'recuperacao', jsonb_build_object('pago_mes_total',0,'pago_mes_qtd',0,'pct_sobre_risco',0,'por_faixa','{}'::jsonb,'serie_6meses','[]'::jsonb),
      'acordos_saude', jsonb_build_object('ativos_qtd',0,'quebrados_qtd',0,'quitados_qtd',0,'fechados_mes',0,'quebrados_mes',0,'taxa_quebra',0,'em_risco_qtd',0,'em_risco_valor',0),
      'cobertura', jsonb_build_object('total_cpfs',0,'cpfs_acionados_mes',0,'pct_acionados',0,'cpfs_convertidos',0,'pct_convertidos',0,'cpfs_intocados_30d_qtd',0)
    );
  END IF;

  WITH
  cart_cpfs AS (
    SELECT cpf_cnpj AS cpf_n, max(faixa) AS faixa, sum(risco) AS risco_total
    FROM public.comite_carteira_nm_item
    WHERE snapshot_id = v_snap_id AND cpf_cnpj IS NOT NULL AND cpf_cnpj <> ''
    GROUP BY cpf_cnpj
  ),
  cart_tot AS (
    SELECT count(*)::int AS total_cpfs, coalesce(sum(risco_total),0) AS total_risco
    FROM cart_cpfs
  ),
  risco_faixa AS (
    SELECT faixa, sum(risco) AS risco
    FROM public.comite_carteira_nm_item
    WHERE snapshot_id = v_snap_id
    GROUP BY faixa
  ),
  acordos_nm AS (
    SELECT a.id, a.status, a.criado_em, a.valor_total, cpf_normalize(a.cliente_cpf) AS cpf_n
    FROM public.acordos a
    WHERE a.cliente_cpf IS NOT NULL
      AND cpf_normalize(a.cliente_cpf) IN (SELECT cpf_n FROM cart_cpfs)
  ),
  pag_mes AS (
    SELECT p.valor_parcela, a.cpf_n
    FROM public.pagamentos p
    JOIN acordos_nm a ON a.id = p.acordo_id
    WHERE p.status='pago'
      AND p.data_paga >= v_ini_mes::date
      AND p.data_paga < v_fim_mes::date
  ),
  pag_mes_tot AS (
    SELECT coalesce(sum(valor_parcela),0) AS pago_mes, count(*)::int AS qtd_mes FROM pag_mes
  ),
  pag_por_faixa AS (
    SELECT c.faixa,
           coalesce(sum(pm.valor_parcela), 0) AS pago,
           coalesce(max(rf.risco), 0) AS risco
    FROM cart_cpfs c
    LEFT JOIN pag_mes pm ON pm.cpf_n = c.cpf_n
    LEFT JOIN risco_faixa rf ON rf.faixa = c.faixa
    GROUP BY c.faixa
  ),
  por_faixa_json AS (
    SELECT coalesce(jsonb_object_agg(faixa,
      jsonb_build_object('pago', pago, 'risco', risco,
        'pct', CASE WHEN risco>0 THEN pago/risco ELSE 0 END)
    ), '{}'::jsonb) AS j
    FROM pag_por_faixa
  ),
  serie AS (
    SELECT to_char(d, 'YYYY-MM') AS mes,
      coalesce((
        SELECT sum(p.valor_parcela)
        FROM public.pagamentos p
        JOIN acordos_nm a ON a.id = p.acordo_id
        WHERE p.status='pago'
          AND p.data_paga >= d::date
          AND p.data_paga < (d + interval '1 month')::date
      ), 0) AS valor
    FROM generate_series(
      date_trunc('month', v_ini_mes) - interval '5 months',
      date_trunc('month', v_ini_mes),
      interval '1 month'
    ) AS d
  ),
  serie_json AS (
    SELECT coalesce(jsonb_agg(jsonb_build_object('mes', mes, 'valor', valor) ORDER BY mes), '[]'::jsonb) AS j
    FROM serie
  ),
  saude AS (
    SELECT
      count(*) FILTER (WHERE status='ativo')::int AS ativos,
      count(*) FILTER (WHERE status='quebrado')::int AS quebrados,
      count(*) FILTER (WHERE status='concluido')::int AS quitados,
      count(*) FILTER (WHERE criado_em >= v_ini_mes AND criado_em < v_fim_mes)::int AS fechados_mes,
      count(*) FILTER (WHERE status='quebrado' AND criado_em >= v_ini_mes AND criado_em < v_fim_mes)::int AS quebrados_mes
    FROM acordos_nm
  ),
  em_risco AS (
    SELECT count(*)::int AS qtd, coalesce(sum(p.valor_parcela),0) AS valor
    FROM public.pagamentos p
    JOIN acordos_nm a ON a.id = p.acordo_id
    WHERE p.status='pendente'
      AND a.status='ativo'
      AND p.data_prevista >= CURRENT_DATE
      AND p.data_prevista <= CURRENT_DATE + interval '7 days'
  ),
  phones AS (
    SELECT DISTINCT cpf_normalize(d.cpf) AS cpf_n,
           right(regexp_replace(d.telefone,'[^0-9]','','g'), 8) AS suf
    FROM public.devedores d
    WHERE d.ativo = true
      AND d.credor IN ('ume_novo_mundo','ume_novo_mundo_aporte')
      AND d.telefone IS NOT NULL
      AND length(regexp_replace(d.telefone,'[^0-9]','','g')) >= 8
      AND cpf_normalize(d.cpf) IN (SELECT cpf_n FROM cart_cpfs)
  ),
  acionados_mes AS (
    SELECT count(DISTINCT p.cpf_n)::int AS qtd
    FROM phones p
    WHERE EXISTS (
      SELECT 1 FROM public.whatsapp_mensagens m
      WHERE m.direcao='saida'
        AND m.timestamp_msg >= v_ini_mes
        AND m.timestamp_msg < v_fim_mes
        AND right(regexp_replace(m.telefone_remoto,'[^0-9]','','g'), 8) = p.suf
    )
  ),
  acionados_30d AS (
    SELECT count(DISTINCT p.cpf_n)::int AS qtd
    FROM phones p
    WHERE EXISTS (
      SELECT 1 FROM public.whatsapp_mensagens m
      WHERE m.direcao='saida'
        AND m.timestamp_msg >= v_ini_30d
        AND right(regexp_replace(m.telefone_remoto,'[^0-9]','','g'), 8) = p.suf
    )
  ),
  convertidos AS (
    SELECT count(DISTINCT cpf_n)::int AS qtd
    FROM acordos_nm
    WHERE status IN ('ativo','concluido')
  )
  SELECT jsonb_build_object(
    'recuperacao', jsonb_build_object(
      'pago_mes_total', (SELECT pago_mes FROM pag_mes_tot),
      'pago_mes_qtd', (SELECT qtd_mes FROM pag_mes_tot),
      'pct_sobre_risco', CASE WHEN (SELECT total_risco FROM cart_tot)>0
                              THEN (SELECT pago_mes FROM pag_mes_tot)/(SELECT total_risco FROM cart_tot)
                              ELSE 0 END,
      'por_faixa', (SELECT j FROM por_faixa_json),
      'serie_6meses', (SELECT j FROM serie_json)
    ),
    'acordos_saude', jsonb_build_object(
      'ativos_qtd', (SELECT ativos FROM saude),
      'quebrados_qtd', (SELECT quebrados FROM saude),
      'quitados_qtd', (SELECT quitados FROM saude),
      'fechados_mes', (SELECT fechados_mes FROM saude),
      'quebrados_mes', (SELECT quebrados_mes FROM saude),
      'taxa_quebra', CASE WHEN (SELECT fechados_mes FROM saude)>0
                          THEN (SELECT quebrados_mes FROM saude)::numeric/(SELECT fechados_mes FROM saude)
                          ELSE 0 END,
      'em_risco_qtd', (SELECT qtd FROM em_risco),
      'em_risco_valor', (SELECT valor FROM em_risco)
    ),
    'cobertura', jsonb_build_object(
      'total_cpfs', (SELECT total_cpfs FROM cart_tot),
      'cpfs_acionados_mes', (SELECT qtd FROM acionados_mes),
      'pct_acionados', CASE WHEN (SELECT total_cpfs FROM cart_tot)>0
                            THEN (SELECT qtd FROM acionados_mes)::numeric/(SELECT total_cpfs FROM cart_tot)
                            ELSE 0 END,
      'cpfs_convertidos', (SELECT qtd FROM convertidos),
      'pct_convertidos', CASE WHEN (SELECT total_cpfs FROM cart_tot)>0
                              THEN (SELECT qtd FROM convertidos)::numeric/(SELECT total_cpfs FROM cart_tot)
                              ELSE 0 END,
      'cpfs_intocados_30d_qtd', greatest((SELECT total_cpfs FROM cart_tot) - (SELECT qtd FROM acionados_30d), 0)
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;