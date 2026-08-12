CREATE OR REPLACE FUNCTION public.envio_meta_job_bump(_job_id uuid, _enviados_inc integer, _erros_inc integer, _proximo_em timestamp with time zone)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  UPDATE public.envio_meta_job
  SET enviados = COALESCE(enviados,0) + COALESCE(_enviados_inc,0),
      erros    = COALESCE(erros,0)    + COALESCE(_erros_inc,0),
      proximo_em = CASE WHEN status = 'rodando' THEN _proximo_em ELSE proximo_em END,
      status_motivo = NULL,
      updated_at = now()
  WHERE id = _job_id;
$function$;