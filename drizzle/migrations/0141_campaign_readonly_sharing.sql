CREATE TABLE public.envio_meta_compartilhamentos (
 job_id uuid NOT NULL REFERENCES public.envio_meta_job(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 criado_em timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(job_id,user_id)
);
GRANT SELECT,INSERT,DELETE ON public.envio_meta_compartilhamentos TO authenticated;
GRANT ALL ON public.envio_meta_compartilhamentos TO service_role;
ALTER TABLE public.envio_meta_compartilhamentos ENABLE ROW LEVEL SECURITY;
CREATE INDEX envio_meta_compartilhamentos_usuario ON public.envio_meta_compartilhamentos(user_id,job_id);
CREATE FUNCTION public.pode_ver_campanha_meta(_job_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT auth.uid() IS NOT NULL AND (EXISTS(SELECT 1 FROM public.envio_meta_job WHERE id=_job_id AND user_id=auth.uid()) OR EXISTS(SELECT 1 FROM public.envio_meta_compartilhamentos WHERE job_id=_job_id AND user_id=auth.uid()));
$$;
REVOKE ALL ON FUNCTION public.pode_ver_campanha_meta(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pode_ver_campanha_meta(uuid) TO authenticated,service_role;
CREATE POLICY compartilhamento_owner_select ON public.envio_meta_compartilhamentos FOR SELECT TO authenticated USING (user_id=auth.uid() OR EXISTS(SELECT 1 FROM public.envio_meta_job WHERE id=job_id AND user_id=auth.uid()));
CREATE POLICY compartilhamento_owner_insert ON public.envio_meta_compartilhamentos FOR INSERT TO authenticated WITH CHECK (EXISTS(SELECT 1 FROM public.envio_meta_job WHERE id=job_id AND user_id=auth.uid()));
CREATE POLICY compartilhamento_owner_delete ON public.envio_meta_compartilhamentos FOR DELETE TO authenticated USING (EXISTS(SELECT 1 FROM public.envio_meta_job WHERE id=job_id AND user_id=auth.uid()));
CREATE POLICY campaign_shared_read ON public.envio_meta_job FOR SELECT TO authenticated USING(public.pode_ver_campanha_meta(id));
CREATE POLICY campaign_items_shared_read ON public.envio_meta_job_item FOR SELECT TO authenticated USING(public.pode_ver_campanha_meta(job_id));
CREATE POLICY campaign_results_shared_read ON public.envio_meta_job_resultado FOR SELECT TO authenticated USING(public.pode_ver_campanha_meta(job_id));
CREATE FUNCTION public.usuarios_compartilhar_campanha(_job_id uuid) RETURNS TABLE(id uuid,nome text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.envio_meta_job WHERE envio_meta_job.id=_job_id AND user_id=auth.uid()) THEN RAISE EXCEPTION 'Acesso negado'; END IF;
 RETURN QUERY SELECT p.id,p.nome::text FROM public.profiles p WHERE p.id<>auth.uid() ORDER BY p.nome;
END;
$$;
REVOKE ALL ON FUNCTION public.usuarios_compartilhar_campanha(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.usuarios_compartilhar_campanha(uuid) TO authenticated;
CREATE FUNCTION public.campanha_meta_logs(_job_id uuid,_wamids text[]) RETURNS TABLE(wa_message_id text,status text,erro text,enviado_em timestamptz) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.pode_ver_campanha_meta(_job_id) THEN RAISE EXCEPTION 'Acesso negado'; END IF;
 RETURN QUERY SELECT l.wa_message_id::text,l.status::text,l.erro::text,l.enviado_em FROM public.meta_whatsapp_envios_log l
 WHERE l.wa_message_id=ANY(_wamids[1:300]) AND EXISTS(SELECT 1 FROM public.envio_meta_job_item i WHERE i.job_id=_job_id AND i.wa_message_id=l.wa_message_id)
 ORDER BY l.enviado_em DESC LIMIT 2000;
END;
$$;
REVOKE ALL ON FUNCTION public.campanha_meta_logs(uuid,text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.campanha_meta_logs(uuid,text[]) TO authenticated;
CREATE FUNCTION public.campanha_meta_instancias_leitura(_job_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE j public.envio_meta_job; resultado jsonb;
BEGIN
 IF NOT public.pode_ver_campanha_meta(_job_id) THEN RAISE EXCEPTION 'Acesso negado'; END IF;
 SELECT * INTO j FROM public.envio_meta_job WHERE id=_job_id;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',m.id,'nome',m.nome,'telefone',m.telefone,'bm',NULL,'qualidade',m.quality_rating,'ativa_cadastro',m.ativo,'enviados',c.enviados,'erros',c.erros,'falhas_consecutivas',0,'ignorada',m.id=ANY(coalesce(j.instancias_bloqueadas_run,ARRAY[]::uuid[])),'motivo_ignorada',NULL,'reativavel',false,'em_uso',false)),'[]'::jsonb) INTO resultado
 FROM public.meta_whatsapp_instances m LEFT JOIN LATERAL(SELECT count(*) FILTER(WHERE status='enviado') AS enviados,count(*) FILTER(WHERE status='erro') AS erros FROM public.envio_meta_job_item WHERE job_id=_job_id AND instancia_id=m.id)c ON true WHERE m.id=ANY(j.instancia_ids);
 RETURN resultado;
END;
$$;
REVOKE ALL ON FUNCTION public.campanha_meta_instancias_leitura(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.campanha_meta_instancias_leitura(uuid) TO authenticated;
DO $migration$
DECLARE f text;
BEGIN
 SELECT pg_get_functiondef('public.envio_meta_job_delivery_resumo(uuid)'::regprocedure) INTO f;
 f:=replace(f,'_job.user_id IS DISTINCT FROM auth.uid()','NOT public.pode_ver_campanha_meta(_job_id)'); EXECUTE f;
 SELECT pg_get_functiondef('public.envio_meta_job_resultado_calcular(uuid)'::regprocedure) INTO f;
 f:=replace(f,'v_job_user_id IS DISTINCT FROM auth.uid()','NOT public.pode_ver_campanha_meta(_job_id)'); EXECUTE f;
 SELECT pg_get_functiondef('public.envio_meta_jobs_delivery_resumo(uuid[])'::regprocedure) INTO f;
 f:=replace(f,'j.user_id = auth.uid()','public.pode_ver_campanha_meta(j.id)'); EXECUTE f;
END;
$migration$;