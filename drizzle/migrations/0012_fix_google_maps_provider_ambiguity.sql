CREATE OR REPLACE FUNCTION public.gm_incrementar_uso_provedor(p_provedor TEXT, p_qtd INTEGER DEFAULT 1)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  novo_total INTEGER;
BEGIN
  IF p_provedor NOT IN ('principal', 'reserva') THEN
    RAISE EXCEPTION 'provedor inválido';
  END IF;

  INSERT INTO public.google_maps_uso_provedor AS uso (mes_referencia, provedor, total_consultas)
  VALUES (public.gm_mes_atual(), p_provedor, GREATEST(p_qtd, 0))
  ON CONFLICT ON CONSTRAINT google_maps_uso_provedor_pkey
  DO UPDATE SET total_consultas = uso.total_consultas + EXCLUDED.total_consultas,
                updated_at = now()
  RETURNING uso.total_consultas INTO novo_total;

  RETURN novo_total;
END;
$$;

CREATE OR REPLACE FUNCTION public.gm_status_provedores()
RETURNS TABLE (
  provedor TEXT,
  total_consultas INTEGER,
  limite_maximo INTEGER,
  limite_bloqueio INTEGER,
  pode_buscar BOOLEAN,
  percentual_consumido NUMERIC,
  configurada BOOLEAN,
  ativa BOOLEAN,
  data_reset DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mes DATE := public.gm_mes_atual();
  reserva_ativa BOOLEAN;
  tem_principal BOOLEAN;
  tem_reserva BOOLEAN;
BEGIN
  INSERT INTO public.google_maps_uso_provedor AS uso (mes_referencia, provedor)
  VALUES (mes, 'principal'), (mes, 'reserva')
  ON CONFLICT ON CONSTRAINT google_maps_uso_provedor_pkey DO NOTHING;

  SELECT c.reserva_ativa_mes = mes,
         COALESCE(NULLIF(BTRIM(c.api_key), ''), '') <> '',
         COALESCE(NULLIF(BTRIM(c.api_key_reserva), ''), '') <> ''
    INTO reserva_ativa, tem_principal, tem_reserva
  FROM public.google_maps_config c
  WHERE c.id = 1;

  RETURN QUERY
  SELECT u.provedor,
         u.total_consultas,
         u.limite_maximo,
         u.limite_bloqueio,
         u.total_consultas < u.limite_bloqueio,
         ROUND((u.total_consultas::NUMERIC / NULLIF(u.limite_maximo, 0)) * 100, 2),
         CASE WHEN u.provedor = 'principal' THEN tem_principal ELSE tem_reserva END,
         CASE WHEN reserva_ativa THEN u.provedor = 'reserva' ELSE u.provedor = 'principal' END,
         (mes + INTERVAL '1 month')::DATE
  FROM public.google_maps_uso_provedor u
  WHERE u.mes_referencia = mes
  ORDER BY CASE WHEN u.provedor = 'principal' THEN 0 ELSE 1 END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.gm_incrementar_uso_provedor(TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.gm_status_provedores() TO authenticated, service_role;