CREATE OR REPLACE FUNCTION public.reserve_tier_250_template_slot(
  p_instancia_id uuid,
  p_template_mestre_id uuid,
  p_origem text DEFAULT 'fila'
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier integer;
  v_dia date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_slot smallint;
  v_legacy_count integer;
BEGIN
  v_tier := public.meta_instance_template_tier(p_instancia_id);
  IF v_tier IS DISTINCT FROM 250 THEN RETURN 'not_limited'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_instancia_id::text || ':' || v_dia::text, 0));

  IF EXISTS (
    SELECT 1 FROM public.meta_template_daily_reservations
    WHERE instancia_id = p_instancia_id AND template_mestre_id = p_template_mestre_id
      AND dia_brt = v_dia AND status IN ('RESERVADO', 'ENVIADO')
  ) THEN RETURN 'already_reserved'; END IF;

  SELECT count(*)::integer INTO v_legacy_count
  FROM public.meta_templates_onboarding_fila f
  WHERE f.instancia_id = p_instancia_id
    AND f.enviado_em >= (v_dia::timestamp AT TIME ZONE 'America/Sao_Paulo')
    AND NOT EXISTS (
      SELECT 1 FROM public.meta_template_daily_reservations r
      WHERE r.instancia_id = f.instancia_id AND r.template_mestre_id = f.template_mestre_id
        AND r.dia_brt = v_dia AND r.status IN ('RESERVADO', 'ENVIADO')
    );

  SELECT s::smallint INTO v_slot
  FROM generate_series(1, 2) s
  WHERE NOT EXISTS (
    SELECT 1 FROM public.meta_template_daily_reservations r
    WHERE r.instancia_id = p_instancia_id AND r.dia_brt = v_dia
      AND r.slot = s AND r.status IN ('RESERVADO', 'ENVIADO')
  )
  ORDER BY s LIMIT 1;

  IF v_slot IS NULL OR v_legacy_count + (
    SELECT count(*) FROM public.meta_template_daily_reservations r
    WHERE r.instancia_id = p_instancia_id AND r.dia_brt = v_dia
      AND r.status IN ('RESERVADO', 'ENVIADO')
  ) >= 2 THEN RETURN 'limit_reached'; END IF;

  DELETE FROM public.meta_template_daily_reservations
  WHERE instancia_id = p_instancia_id AND template_mestre_id = p_template_mestre_id
    AND dia_brt = v_dia AND status = 'FALHA';

  INSERT INTO public.meta_template_daily_reservations
    (instancia_id, template_mestre_id, dia_brt, slot, origem)
  VALUES (p_instancia_id, p_template_mestre_id, v_dia, v_slot,
    left(COALESCE(NULLIF(trim(p_origem), ''), 'fila'), 80));
  RETURN 'reserved';
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_tier_250_template_slot(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_tier_250_template_slot(uuid, uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.finish_tier_250_template_slot(
  p_instancia_id uuid,
  p_template_mestre_id uuid,
  p_status text,
  p_detalhe text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF upper(p_status) = 'ENVIADO' THEN
    UPDATE public.meta_template_daily_reservations
    SET status = 'ENVIADO', detalhe = left(p_detalhe, 1000), atualizado_em = now()
    WHERE instancia_id = p_instancia_id AND template_mestre_id = p_template_mestre_id
      AND dia_brt = (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  ELSE
    DELETE FROM public.meta_template_daily_reservations
    WHERE instancia_id = p_instancia_id AND template_mestre_id = p_template_mestre_id
      AND dia_brt = (now() AT TIME ZONE 'America/Sao_Paulo')::date AND status <> 'ENVIADO';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.finish_tier_250_template_slot(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_tier_250_template_slot(uuid, uuid, text, text) TO service_role;