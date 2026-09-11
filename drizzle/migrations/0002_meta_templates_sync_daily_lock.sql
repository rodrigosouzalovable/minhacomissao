CREATE TABLE public.meta_templates_sync_state (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  status text NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'running', 'completed', 'failed')),
  lock_expires_at timestamptz,
  last_started_at timestamptz,
  last_completed_at timestamptz,
  last_success boolean,
  processed_instances integer NOT NULL DEFAULT 0,
  synced_templates integer NOT NULL DEFAULT 0,
  failures jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.meta_templates_sync_state TO service_role;

ALTER TABLE public.meta_templates_sync_state ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.claim_meta_templates_sync_diario(
  p_force boolean DEFAULT false,
  p_lock_minutes integer DEFAULT 30
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claimed boolean := false;
BEGIN
  INSERT INTO public.meta_templates_sync_state (
    id, status, lock_expires_at, last_started_at, last_success, updated_at
  ) VALUES (
    true, 'running', now() + make_interval(mins => greatest(5, least(p_lock_minutes, 120))), now(), null, now()
  )
  ON CONFLICT (id) DO UPDATE SET
    status = 'running',
    lock_expires_at = EXCLUDED.lock_expires_at,
    last_started_at = now(),
    last_success = null,
    processed_instances = 0,
    synced_templates = 0,
    failures = '[]'::jsonb,
    updated_at = now()
  WHERE p_force
     OR public.meta_templates_sync_state.lock_expires_at IS NULL
     OR public.meta_templates_sync_state.lock_expires_at <= now()
     OR public.meta_templates_sync_state.last_completed_at IS NULL
     OR (public.meta_templates_sync_state.last_completed_at AT TIME ZONE 'America/Sao_Paulo')::date < (now() AT TIME ZONE 'America/Sao_Paulo')::date;

  GET DIAGNOSTICS v_claimed = ROW_COUNT;
  RETURN v_claimed;
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_meta_templates_sync_diario(
  p_success boolean,
  p_processed integer DEFAULT 0,
  p_synced integer DEFAULT 0,
  p_failures jsonb DEFAULT '[]'::jsonb
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.meta_templates_sync_state
  SET status = CASE WHEN p_success THEN 'completed' ELSE 'failed' END,
      lock_expires_at = null,
      last_completed_at = now(),
      last_success = p_success,
      processed_instances = greatest(0, p_processed),
      synced_templates = greatest(0, p_synced),
      failures = coalesce(p_failures, '[]'::jsonb),
      updated_at = now()
  WHERE id = true;
$$;

REVOKE ALL ON FUNCTION public.claim_meta_templates_sync_diario(boolean, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_meta_templates_sync_diario(boolean, integer, integer, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_meta_templates_sync_diario(boolean, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_meta_templates_sync_diario(boolean, integer, integer, jsonb) TO service_role;