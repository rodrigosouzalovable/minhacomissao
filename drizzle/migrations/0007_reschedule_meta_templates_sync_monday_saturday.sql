DO $$
DECLARE
  v_job_id bigint;
  v_command text;
BEGIN
  SELECT jobid, command
  INTO v_job_id, v_command
  FROM cron.job
  WHERE jobname = 'meta-templates-sincronizar-diario'
  LIMIT 1;

  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
    PERFORM cron.schedule(
      'meta-templates-sincronizar-diario',
      '0 9 * * 1-6',
      v_command
    );
  END IF;
END;
$$;