ALTER TABLE public.google_maps_buscas
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS requisicoes_places integer NOT NULL DEFAULT 0;

ALTER TABLE public.google_maps_buscas
  ADD CONSTRAINT google_maps_buscas_requisicoes_places_nonnegative
  CHECK (requisicoes_places >= 0) NOT VALID;

CREATE INDEX IF NOT EXISTS idx_google_maps_buscas_origem_created_at
  ON public.google_maps_buscas (origem, created_at DESC);

CREATE TABLE public.google_maps_abastecimento_state (
  id boolean PRIMARY KEY DEFAULT true,
  lock_token uuid,
  lock_expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT google_maps_abastecimento_state_singleton CHECK (id = true)
);
GRANT SELECT ON public.google_maps_abastecimento_state TO authenticated;
GRANT ALL ON public.google_maps_abastecimento_state TO service_role;
ALTER TABLE public.google_maps_abastecimento_state ENABLE ROW LEVEL SECURITY;

INSERT INTO public.google_maps_abastecimento_state (id)
VALUES (true)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.gm_abastecimento_claim(
  p_token uuid,
  p_lock_minutes integer DEFAULT 9
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claimed boolean := false;
BEGIN
  INSERT INTO public.google_maps_abastecimento_state (
    id, lock_token, lock_expires_at, updated_at
  ) VALUES (
    true,
    p_token,
    now() + make_interval(mins => greatest(1, least(p_lock_minutes, 30))),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    lock_token = EXCLUDED.lock_token,
    lock_expires_at = EXCLUDED.lock_expires_at,
    updated_at = now()
  WHERE public.google_maps_abastecimento_state.lock_expires_at IS NULL
     OR public.google_maps_abastecimento_state.lock_expires_at <= now();

  GET DIAGNOSTICS v_claimed = ROW_COUNT;
  RETURN v_claimed;
END;
$$;

CREATE OR REPLACE FUNCTION public.gm_abastecimento_release(p_token uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_released boolean := false;
BEGIN
  UPDATE public.google_maps_abastecimento_state
  SET lock_token = null,
      lock_expires_at = null,
      updated_at = now()
  WHERE id = true
    AND lock_token = p_token;

  GET DIAGNOSTICS v_released = ROW_COUNT;
  RETURN v_released;
END;
$$;

REVOKE ALL ON FUNCTION public.gm_abastecimento_claim(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gm_abastecimento_release(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gm_abastecimento_claim(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.gm_abastecimento_release(uuid) TO service_role;