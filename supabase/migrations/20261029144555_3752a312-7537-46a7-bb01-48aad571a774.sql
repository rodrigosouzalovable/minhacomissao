CREATE OR REPLACE FUNCTION public.recuperacao_quebrados_autorizada(p_token text)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
 SELECT length(coalesce(p_token,'')) > 32 AND EXISTS (
  SELECT 1 FROM cron.job WHERE jobname='recuperacao-quebrados-0930' AND active
  AND substring(command FROM 'Bearer ([A-Za-z0-9_.-]+)') = p_token);
$$;
REVOKE ALL ON FUNCTION public.recuperacao_quebrados_autorizada(text) FROM public, anon, authenticated;