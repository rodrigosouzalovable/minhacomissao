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
  WHERE p_force OR (
    (public.meta_templates_sync_state.status <> 'running'
      OR public.meta_templates_sync_state.lock_expires_at IS NULL
      OR public.meta_templates_sync_state.lock_expires_at <= now())
    AND (
      public.meta_templates_sync_state.last_completed_at IS NULL
      OR (public.meta_templates_sync_state.last_completed_at AT TIME ZONE 'America/Sao_Paulo')::date
         < (now() AT TIME ZONE 'America/Sao_Paulo')::date
    )
  );

  GET DIAGNOSTICS v_claimed = ROW_COUNT;
  RETURN v_claimed;
END;
$$;