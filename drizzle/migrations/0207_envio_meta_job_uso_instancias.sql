CREATE OR REPLACE FUNCTION public.envio_meta_job_uso_instancias(p_job_id uuid)
RETURNS TABLE(instancia_id uuid, enviados bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.instancia_id, count(*) FROM public.envio_meta_job_item i
  WHERE i.job_id = p_job_id AND i.status = 'enviado' AND i.instancia_id IS NOT NULL
  GROUP BY i.instancia_id
$$;
REVOKE ALL ON FUNCTION public.envio_meta_job_uso_instancias(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.envio_meta_job_uso_instancias(uuid) TO service_role;