
CREATE OR REPLACE FUNCTION public.envio_meta_job_bump(
  _job_id uuid,
  _enviados_inc integer,
  _erros_inc integer,
  _proximo_em timestamptz
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.envio_meta_job
  SET enviados = COALESCE(enviados,0) + COALESCE(_enviados_inc,0),
      erros    = COALESCE(erros,0)    + COALESCE(_erros_inc,0),
      proximo_em = _proximo_em,
      status_motivo = NULL,
      updated_at = now()
  WHERE id = _job_id;
$$;

REVOKE ALL ON FUNCTION public.envio_meta_job_bump(uuid, integer, integer, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.envio_meta_job_bump(uuid, integer, integer, timestamptz) TO service_role;
