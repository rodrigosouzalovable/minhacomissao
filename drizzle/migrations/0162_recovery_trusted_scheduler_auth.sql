CREATE OR REPLACE FUNCTION public.meta_recuperacao_scheduler_autorizado(p_token text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT length(coalesce(p_token,'')) > 32 AND EXISTS (
 SELECT 1 FROM cron.job WHERE jobname='meta-recuperacao-tick' AND active
 AND substring(command FROM 'Bearer ([A-Za-z0-9_.-]+)') = p_token
 );
$$;
REVOKE ALL ON FUNCTION public.meta_recuperacao_scheduler_autorizado(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.meta_recuperacao_scheduler_autorizado(text) TO service_role;