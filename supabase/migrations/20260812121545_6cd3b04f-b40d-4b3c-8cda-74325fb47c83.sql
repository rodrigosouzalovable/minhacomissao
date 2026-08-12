ALTER TABLE public.envio_meta_job
  ADD COLUMN IF NOT EXISTS worker_lock_token uuid,
  ADD COLUMN IF NOT EXISTS worker_locked_until timestamptz;

CREATE INDEX IF NOT EXISTS idx_envio_meta_job_due_running
  ON public.envio_meta_job (proximo_em, iniciado_em)
  WHERE status = 'rodando';

CREATE OR REPLACE FUNCTION public.envio_meta_claim_due_job(
  _job_id uuid DEFAULT NULL,
  _lock_seconds integer DEFAULT 45
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _claimed public.envio_meta_job%ROWTYPE;
  _token uuid := gen_random_uuid();
BEGIN
  SELECT j.*
    INTO _claimed
    FROM public.envio_meta_job j
   WHERE j.status = 'rodando'
     AND (_job_id IS NULL OR j.id = _job_id)
     AND (j.proximo_em IS NULL OR j.proximo_em <= now())
     AND (j.worker_locked_until IS NULL OR j.worker_locked_until < now())
   ORDER BY j.iniciado_em ASC
   FOR UPDATE SKIP LOCKED
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  UPDATE public.envio_meta_job
     SET worker_lock_token = _token,
         worker_locked_until = now() + make_interval(secs => GREATEST(10, LEAST(COALESCE(_lock_seconds, 45), 120)))
   WHERE id = _claimed.id
   RETURNING * INTO _claimed;

  RETURN to_jsonb(_claimed);
END;
$$;

REVOKE ALL ON FUNCTION public.envio_meta_claim_due_job(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.envio_meta_claim_due_job(uuid, integer) TO service_role;

COMMENT ON FUNCTION public.envio_meta_claim_due_job(uuid, integer)
IS 'Claims one due running Meta campaign atomically so concurrent ticks cannot overlap sends.';