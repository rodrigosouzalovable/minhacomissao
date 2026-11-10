CREATE OR REPLACE FUNCTION public.scheduler_token_autorizado(p_token text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(p_token, '') ~ '^[A-Za-z0-9_.-]{32,}$'
     AND left(p_token, 3) <> 'eyJ'
     AND EXISTS (
       SELECT 1 FROM cron.job
        WHERE active
          AND position(('Bearer ' || p_token || '"') IN command) > 0
     );
$$;

REVOKE ALL ON FUNCTION public.scheduler_token_autorizado(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scheduler_token_autorizado(text) TO service_role;