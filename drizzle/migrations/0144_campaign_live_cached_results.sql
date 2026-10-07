CREATE OR REPLACE FUNCTION public.campanha_meta_resultado_ao_vivo(_job_id uuid) RETURNS public.envio_meta_job_resultado LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.envio_meta_job_resultado;
BEGIN
 IF NOT public.pode_ver_campanha_meta(_job_id) THEN RAISE EXCEPTION 'Acesso negado' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM public.envio_meta_job_resultado WHERE job_id=_job_id;
 IF r.calculado_em > now()-interval '60 seconds' THEN RETURN r; END IF;
 IF NOT pg_try_advisory_xact_lock(hashtextextended(_job_id::text, 7144)) THEN RETURN r; END IF;
 SELECT * INTO r FROM public.envio_meta_job_resultado WHERE job_id=_job_id;
 IF r.calculado_em > now()-interval '60 seconds' THEN RETURN r; END IF;
 RETURN public.envio_meta_job_resultado_calcular(_job_id);
END;
$$;
REVOKE ALL ON FUNCTION public.campanha_meta_resultado_ao_vivo(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.campanha_meta_resultado_ao_vivo(uuid) TO authenticated;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='envio_meta_job_resultado') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.envio_meta_job_resultado; END IF;
END $$;