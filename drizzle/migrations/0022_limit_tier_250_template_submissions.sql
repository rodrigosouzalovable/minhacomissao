CREATE TABLE public.meta_template_daily_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instancia_id uuid NOT NULL REFERENCES public.meta_whatsapp_instances(id) ON DELETE CASCADE,
  template_mestre_id uuid NOT NULL REFERENCES public.meta_templates_mestre(id) ON DELETE CASCADE,
  dia_brt date NOT NULL,
  slot smallint NOT NULL CHECK (slot BETWEEN 1 AND 2),
  origem text NOT NULL DEFAULT 'fila',
  status text NOT NULL DEFAULT 'RESERVADO' CHECK (status IN ('RESERVADO', 'ENVIADO', 'FALHA')),
  detalhe text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instancia_id, dia_brt, slot),
  UNIQUE (instancia_id, template_mestre_id, dia_brt)
);

GRANT ALL ON public.meta_template_daily_reservations TO service_role;

ALTER TABLE public.meta_template_daily_reservations ENABLE ROW LEVEL SECURITY;

CREATE INDEX meta_template_daily_reservations_instancia_dia_idx
  ON public.meta_template_daily_reservations (instancia_id, dia_brt);

CREATE OR REPLACE FUNCTION public.meta_instance_template_tier(p_instancia_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN b.tier_ilimitado THEN 999999
    WHEN b.tier_manual THEN b.tier_diario
    ELSE COALESCE(
      public.meta_tier_valor(i.messaging_limit_manual),
      public.meta_tier_valor(i.saude_tier),
      i.tier_diario,
      b.tier_diario,
      1000
    )
  END
  FROM public.meta_whatsapp_instances i
  LEFT JOIN public.meta_business_managers b ON b.id = i.meta_bm_id
  WHERE i.id = p_instancia_id
$$;

REVOKE ALL ON FUNCTION public.meta_instance_template_tier(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.meta_instance_template_tier(uuid) TO service_role;

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
  IF v_tier IS DISTINCT FROM 250 THEN
    RETURN 'not_limited';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_instancia_id::text || ':' || v_dia::text, 0));

  IF EXISTS (
    SELECT 1
    FROM public.meta_template_daily_reservations
    WHERE instancia_id = p_instancia_id
      AND template_mestre_id = p_template_mestre_id
      AND dia_brt = v_dia
  ) THEN
    RETURN 'already_reserved';
  END IF;

  SELECT count(*)::integer INTO v_legacy_count
  FROM public.meta_templates_onboarding_fila f
  WHERE f.instancia_id = p_instancia_id
    AND f.enviado_em >= (v_dia::timestamp AT TIME ZONE 'America/Sao_Paulo')
    AND NOT EXISTS (
      SELECT 1
      FROM public.meta_template_daily_reservations r
      WHERE r.instancia_id = f.instancia_id
        AND r.template_mestre_id = f.template_mestre_id
        AND r.dia_brt = v_dia
    );

  SELECT COALESCE(max(slot), 0) + 1 INTO v_slot
  FROM public.meta_template_daily_reservations
  WHERE instancia_id = p_instancia_id
    AND dia_brt = v_dia;

  v_slot := GREATEST(v_slot, v_legacy_count + 1);
  IF v_slot > 2 THEN
    RETURN 'limit_reached';
  END IF;

  INSERT INTO public.meta_template_daily_reservations (
    instancia_id, template_mestre_id, dia_brt, slot, origem
  ) VALUES (
    p_instancia_id,
    p_template_mestre_id,
    v_dia,
    v_slot,
    left(COALESCE(NULLIF(trim(p_origem), ''), 'fila'), 80)
  );

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
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.meta_template_daily_reservations
  SET status = CASE WHEN upper(p_status) = 'ENVIADO' THEN 'ENVIADO' ELSE 'FALHA' END,
      detalhe = left(p_detalhe, 1000),
      atualizado_em = now()
  WHERE instancia_id = p_instancia_id
    AND template_mestre_id = p_template_mestre_id
    AND dia_brt = (now() AT TIME ZONE 'America/Sao_Paulo')::date
$$;

REVOKE ALL ON FUNCTION public.finish_tier_250_template_slot(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_tier_250_template_slot(uuid, uuid, text, text) TO service_role;