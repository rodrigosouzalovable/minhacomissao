CREATE OR REPLACE FUNCTION public.relatorio_quebras_diario(p_dia date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH p1 AS (
    SELECT a.empresa, p.data_prevista, p.status, p.valor_parcela, a.criado_em, a.data_primeiro_pagamento
    FROM pagamentos p JOIN acordos a ON a.id = p.acordo_id
    WHERE p.numero_parcela = 1 AND p.data_prevista BETWEEN p_dia - 7 AND p_dia
  )
  SELECT jsonb_build_object(
    'ontem', (SELECT jsonb_agg(jsonb_build_object('empresa', empresa, 'total', t, 'pagos', pg, 'valor_quebrado', vq)) FROM (
       SELECT empresa, count(*) t, count(*) FILTER (WHERE status='pago') pg,
              coalesce(sum(valor_parcela) FILTER (WHERE status<>'pago'),0) vq
       FROM p1 WHERE data_prevista = p_dia GROUP BY empresa) x),
    'semana_total', (SELECT count(*) FROM p1 WHERE data_prevista < p_dia),
    'semana_pagos', (SELECT count(*) FROM p1 WHERE data_prevista < p_dia AND status='pago'),
    'curtos_total', (SELECT count(*) FROM p1 WHERE data_prevista <= p_dia AND data_prevista - (criado_em AT TIME ZONE 'America/Sao_Paulo')::date <= 1),
    'curtos_pagos', (SELECT count(*) FROM p1 WHERE data_prevista <= p_dia AND data_prevista - (criado_em AT TIME ZONE 'America/Sao_Paulo')::date <= 1 AND status='pago'),
    'longos_total', (SELECT count(*) FROM p1 WHERE data_prevista <= p_dia AND data_prevista - (criado_em AT TIME ZONE 'America/Sao_Paulo')::date > 1),
    'longos_pagos', (SELECT count(*) FROM p1 WHERE data_prevista <= p_dia AND data_prevista - (criado_em AT TIME ZONE 'America/Sao_Paulo')::date > 1 AND status='pago')
  );
$$;
REVOKE ALL ON FUNCTION public.relatorio_quebras_diario(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.relatorio_quebras_diario(date) TO service_role;