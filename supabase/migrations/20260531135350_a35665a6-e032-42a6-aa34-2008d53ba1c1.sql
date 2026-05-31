
-- KPIs enriquecidos do Comitê Novo Mundo
CREATE OR REPLACE FUNCTION public.comite_carteira_nm_kpis_extras(p_mes_ano text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snap_id uuid;
  v_total_risco numeric := 0;
  v_total_cpfs int := 0;
  v_ini_mes timestamptz;
  v_fim_mes timestamptz;
  v_ini_30d timestamptz := now() - interval '30 days';
  v_pago_mes numeric := 0;
  v_pago_qtd_mes int := 0;
  v_por_faixa jsonb := '{}'::jsonb;
  v_serie jsonb := '[]'::jsonb;
  v_ativos int := 0;
  v_quebrados int := 0;
  v_quitados int := 0;
  v_fechados_mes int := 0;
  v_quebrados_mes int := 0;
  v_em_risco_qtd int := 0;
  v_em_risco_valor numeric := 0;
  v_acionados_mes int := 0;
  v_convertidos int := 0;
  v_intocados_30d int := 0;
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
      'recuperacao', jsonb_build_object('pago_mes_total',0,'pct_sobre_risco',0,'por_faixa','{}'::jsonb,'serie_6meses','[]'::jsonb),
      'acordos_saude', jsonb_build_object('ativos_qtd',0,'quebrados_qtd',0,'quitados_qtd',0,'fechados_mes',0,'quebrados_mes',0,'taxa_quebra',0,'em_risco_qtd',0,'em_risco_valor',0),
      'cobertura', jsonb_build_object('total_cpfs',0,'cpfs_acionados_mes',0,'pct_acionados',0,'cpfs_convertidos',0,'pct_convertidos',0,'cpfs_intocados_30d_qtd',0)
    );
  END IF;

  -- Carteira: totais e mapa de CPFs normalizados → risco/faixa
  CREATE TEMP TABLE IF NOT EXISTS tmp_cart_cpfs ON COMMIT DROP AS
    SELECT cpf_cnpj AS cpf_n,
           max(faixa) AS faixa,
           sum(risco) AS risco_total
    FROM public.comite_carteira_nm_item
    WHERE snapshot_id = v_snap_id AND cpf_cnpj IS NOT NULL AND cpf_cnpj <> ''
    GROUP BY cpf_cnpj;

  SELECT count(*), coalesce(sum(risco_total),0) INTO v_total_cpfs, v_total_risco
  FROM tmp_cart_cpfs;

  -- Risco por faixa (do snapshot)
  CREATE TEMP TABLE IF NOT EXISTS tmp_risco_faixa ON COMMIT DROP AS
    SELECT faixa, sum(risco) AS risco
    FROM public.comite_carteira_nm_item
    WHERE snapshot_id = v_snap_id
    GROUP BY faixa;

  -- Acordos Novo Mundo (por CPF batendo com carteira)
  CREATE TEMP TABLE IF NOT EXISTS tmp_acordos_nm ON COMMIT DROP AS
    SELECT a.id, a.status, a.criado_em, a.valor_total, cpf_normalize(a.cliente_cpf) AS cpf_n
    FROM public.acordos a
    WHERE a.cliente_cpf IS NOT NULL
      AND cpf_normalize(a.cliente_cpf) IN (SELECT cpf_n FROM tmp_cart_cpfs);

  -- Bloco 1: recuperação no mês (pagamentos pagos no mês para acordos NM)
  SELECT coalesce(sum(p.valor_parcela),0), count(*)
    INTO v_pago_mes, v_pago_qtd_mes
  FROM public.pagamentos p
  JOIN tmp_acordos_nm a ON a.id = p.acordo_id
  WHERE p.status='pago'
    AND p.data_paga >= v_ini_mes::date
    AND p.data_paga < v_fim_mes::date;

  -- Por faixa: pagamento mês × faixa do CPF
  SELECT coalesce(jsonb_object_agg(faixa, jsonb_build_object('pago', pago, 'risco', risco, 'pct', CASE WHEN risco>0 THEN pago/risco ELSE 0 END)), '{}'::jsonb)
    INTO v_por_faixa
  FROM (
    SELECT c.faixa,
           coalesce(sum(p.valor_parcela) FILTER (WHERE p.status='pago' AND p.data_paga >= v_ini_mes::date AND p.data_paga < v_fim_mes::date), 0) AS pago,
           coalesce(max(rf.risco), 0) AS risco
    FROM tmp_cart_cpfs c
    LEFT JOIN tmp_acordos_nm a ON a.cpf_n = c.cpf_n
    LEFT JOIN public.pagamentos p ON p.acordo_id = a.id
    LEFT JOIN tmp_risco_faixa rf ON rf.faixa = c.faixa
    GROUP BY c.faixa
  ) t;

  -- Série 6 meses
  SELECT coalesce(jsonb_agg(jsonb_build_object('mes', mes, 'valor', valor) ORDER BY mes), '[]'::jsonb)
    INTO v_serie
  FROM (
    SELECT to_char(d, 'YYYY-MM') AS mes,
      coalesce((
        SELECT sum(p.valor_parcela)
        FROM public.pagamentos p
        JOIN tmp_acordos_nm a ON a.id = p.acordo_id
        WHERE p.status='pago'
          AND p.data_paga >= d::date
          AND p.data_paga < (d + interval '1 month')::date
      ), 0) AS valor
    FROM generate_series(
      date_trunc('month', v_ini_mes) - interval '5 months',
      date_trunc('month', v_ini_mes),
      interval '1 month'
    ) AS d
  ) s;

  -- Bloco 2: saúde dos acordos
  SELECT
    count(*) FILTER (WHERE status='ativo'),
    count(*) FILTER (WHERE status='quebrado'),
    count(*) FILTER (WHERE status='concluido'),
    count(*) FILTER (WHERE criado_em >= v_ini_mes AND criado_em < v_fim_mes),
    count(*) FILTER (WHERE status='quebrado' AND criado_em >= v_ini_mes AND criado_em < v_fim_mes)
  INTO v_ativos, v_quebrados, v_quitados, v_fechados_mes, v_quebrados_mes
  FROM tmp_acordos_nm;

  SELECT count(*), coalesce(sum(p.valor_parcela),0)
    INTO v_em_risco_qtd, v_em_risco_valor
  FROM public.pagamentos p
  JOIN tmp_acordos_nm a ON a.id = p.acordo_id
  WHERE p.status='pendente'
    AND a.status='ativo'
    AND p.data_prevista >= CURRENT_DATE
    AND p.data_prevista <= CURRENT_DATE + interval '7 days';

  -- Bloco 3: cobertura — telefones Novo Mundo da carteira × mensagens enviadas
  CREATE TEMP TABLE IF NOT EXISTS tmp_phones ON COMMIT DROP AS
    SELECT DISTINCT cpf_normalize(d.cpf) AS cpf_n,
           right(regexp_replace(d.telefone,'[^0-9]','','g'), 8) AS suf
    FROM public.devedores d
    WHERE d.ativo = true
      AND d.credor IN ('ume_novo_mundo','ume_novo_mundo_aporte')
      AND d.telefone IS NOT NULL
      AND length(regexp_replace(d.telefone,'[^0-9]','','g')) >= 8
      AND cpf_normalize(d.cpf) IN (SELECT cpf_n FROM tmp_cart_cpfs);

  -- Acionados no mês
  SELECT count(DISTINCT p.cpf_n) INTO v_acionados_mes
  FROM tmp_phones p
  WHERE EXISTS (
    SELECT 1 FROM public.whatsapp_mensagens m
    WHERE m.direcao='saida'
      AND m.timestamp_msg >= v_ini_mes
      AND m.timestamp_msg < v_fim_mes
      AND right(regexp_replace(m.telefone_remoto,'[^0-9]','','g'), 8) = p.suf
  );

  -- Convertidos: CPF da carteira com acordo ativo ou concluido
  SELECT count(DISTINCT cpf_n) INTO v_convertidos
  FROM tmp_acordos_nm
  WHERE status IN ('ativo','concluido');

  -- Intocados há +30 dias: total carteira - cpfs com mensagem nos últimos 30 dias
  SELECT v_total_cpfs - count(DISTINCT p.cpf_n) INTO v_intocados_30d
  FROM tmp_phones p
  WHERE EXISTS (
    SELECT 1 FROM public.whatsapp_mensagens m
    WHERE m.direcao='saida'
      AND m.timestamp_msg >= v_ini_30d
      AND right(regexp_replace(m.telefone_remoto,'[^0-9]','','g'), 8) = p.suf
  );

  -- Limpar temp tables
  DROP TABLE IF EXISTS tmp_cart_cpfs;
  DROP TABLE IF EXISTS tmp_risco_faixa;
  DROP TABLE IF EXISTS tmp_acordos_nm;
  DROP TABLE IF EXISTS tmp_phones;

  v_result := jsonb_build_object(
    'recuperacao', jsonb_build_object(
      'pago_mes_total', v_pago_mes,
      'pago_mes_qtd', v_pago_qtd_mes,
      'pct_sobre_risco', CASE WHEN v_total_risco>0 THEN v_pago_mes/v_total_risco ELSE 0 END,
      'por_faixa', v_por_faixa,
      'serie_6meses', v_serie
    ),
    'acordos_saude', jsonb_build_object(
      'ativos_qtd', v_ativos,
      'quebrados_qtd', v_quebrados,
      'quitados_qtd', v_quitados,
      'fechados_mes', v_fechados_mes,
      'quebrados_mes', v_quebrados_mes,
      'taxa_quebra', CASE WHEN v_fechados_mes>0 THEN v_quebrados_mes::numeric/v_fechados_mes ELSE 0 END,
      'em_risco_qtd', v_em_risco_qtd,
      'em_risco_valor', v_em_risco_valor
    ),
    'cobertura', jsonb_build_object(
      'total_cpfs', v_total_cpfs,
      'cpfs_acionados_mes', v_acionados_mes,
      'pct_acionados', CASE WHEN v_total_cpfs>0 THEN v_acionados_mes::numeric/v_total_cpfs ELSE 0 END,
      'cpfs_convertidos', v_convertidos,
      'pct_convertidos', CASE WHEN v_total_cpfs>0 THEN v_convertidos::numeric/v_total_cpfs ELSE 0 END,
      'cpfs_intocados_30d_qtd', greatest(v_intocados_30d, 0)
    )
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.comite_carteira_nm_kpis_extras(text) TO authenticated;

-- Lista paginada de CPFs intocados há +30 dias (admin-only)
CREATE OR REPLACE FUNCTION public.comite_carteira_nm_intocados(p_limit int DEFAULT 100)
RETURNS TABLE(cpf_cnpj text, faixa text, risco numeric, nome text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snap_id uuid;
  v_ini_30d timestamptz := now() - interval '30 days';
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'acesso negado';
  END IF;

  SELECT id INTO v_snap_id
  FROM public.comite_carteira_nm_snapshot
  WHERE ativo = true
  ORDER BY importado_em DESC
  LIMIT 1;

  IF v_snap_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH cart AS (
    SELECT i.cpf_cnpj, max(i.faixa) AS faixa, sum(i.risco) AS risco
    FROM public.comite_carteira_nm_item i
    WHERE i.snapshot_id = v_snap_id AND i.cpf_cnpj IS NOT NULL AND i.cpf_cnpj <> ''
    GROUP BY i.cpf_cnpj
  ),
  phones AS (
    SELECT DISTINCT cpf_normalize(d.cpf) AS cpf_n,
           right(regexp_replace(d.telefone,'[^0-9]','','g'), 8) AS suf,
           d.nome
    FROM public.devedores d
    WHERE d.ativo = true
      AND d.credor IN ('ume_novo_mundo','ume_novo_mundo_aporte')
      AND d.telefone IS NOT NULL
      AND length(regexp_replace(d.telefone,'[^0-9]','','g')) >= 8
  ),
  acionados AS (
    SELECT DISTINCT p.cpf_n
    FROM phones p
    WHERE EXISTS (
      SELECT 1 FROM public.whatsapp_mensagens m
      WHERE m.direcao='saida'
        AND m.timestamp_msg >= v_ini_30d
        AND right(regexp_replace(m.telefone_remoto,'[^0-9]','','g'), 8) = p.suf
    )
  )
  SELECT c.cpf_cnpj, c.faixa, c.risco,
         (SELECT max(p.nome) FROM phones p WHERE p.cpf_n = c.cpf_cnpj) AS nome
  FROM cart c
  WHERE c.cpf_cnpj NOT IN (SELECT cpf_n FROM acionados)
  ORDER BY c.risco DESC NULLS LAST
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.comite_carteira_nm_intocados(int) TO authenticated;
