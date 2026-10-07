CREATE OR REPLACE FUNCTION public.campanha_meta_instancias_leitura(_job_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE j public.envio_meta_job; resultado jsonb;
BEGIN
 IF NOT public.pode_ver_campanha_meta(_job_id) THEN RAISE EXCEPTION 'Acesso negado'; END IF;
 SELECT * INTO j FROM public.envio_meta_job WHERE id=_job_id;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',m.id,'nome',m.nome,'telefone',m.telefone,'bm',NULL,'qualidade',m.quality_rating,'ativa_cadastro',m.ativo,'enviados',c.enviados,'erros',c.erros,'falhas_consecutivas',0,'ignorada',coalesce(j.instancias_bloqueadas_run,'[]'::jsonb) ? m.id::text,'motivo_ignorada',NULL,'reativavel',false,'em_uso',false)),'[]'::jsonb) INTO resultado
 FROM public.meta_whatsapp_instances m LEFT JOIN LATERAL(SELECT count(*) FILTER(WHERE status='enviado') AS enviados,count(*) FILTER(WHERE status='erro') AS erros FROM public.envio_meta_job_item WHERE job_id=_job_id AND instancia_id=m.id)c ON true WHERE m.id=ANY(j.instancia_ids);
 RETURN resultado;
END;
$$;