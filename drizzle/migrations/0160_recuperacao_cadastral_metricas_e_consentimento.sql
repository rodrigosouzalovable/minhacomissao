ALTER TABLE public.meta_recuperacao_cadastral_config ADD COLUMN custo_autorizado_em timestamptz, ADD COLUMN custo_autorizado_por uuid, ADD COLUMN custo_limite_diario_brl numeric;
ALTER TABLE public.meta_qualidade_recuperacao_ciclos ADD COLUMN primeiro_envio_recuperacao_em timestamptz, ADD COLUMN envios_recuperacao_aceitos integer NOT NULL DEFAULT 0, ADD COLUMN envios_google_maps_aceitos integer NOT NULL DEFAULT 0, ADD COLUMN respostas_recuperacao integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS recuperacao_log_ciclo_envios_idx ON public.meta_recuperacao_log(instancia_id,enviado_em) WHERE status='enviado' AND tipo LIKE 'recuperacao:%';
UPDATE public.meta_qualidade_recuperacao_ciclos c SET primeiro_envio_recuperacao_em=a.primeiro, envios_recuperacao_aceitos=a.total, envios_google_maps_aceitos=a.maps, respostas_recuperacao=a.respostas FROM (SELECT c2.id,min(l.enviado_em) AS primeiro,count(l.id)::integer AS total,count(l.id) FILTER(WHERE l.fonte IN ('confirmado','candidato'))::integer AS maps,count(l.id) FILTER(WHERE l.resposta_em IS NOT NULL)::integer AS respostas FROM public.meta_qualidade_recuperacao_ciclos c2 LEFT JOIN public.meta_recuperacao_log l ON l.instancia_id=c2.instancia_id AND l.enviado_em>=c2.caiu_em AND (c2.voltou_green_em IS NULL OR l.enviado_em<=c2.voltou_green_em) AND l.status='enviado' AND l.tipo LIKE 'recuperacao:%' GROUP BY c2.id) a WHERE c.id=a.id;
CREATE OR REPLACE FUNCTION public.registrar_envio_ciclo_recuperacao_meta() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_envio boolean; v_resposta boolean;
BEGIN
 IF NEW.status IS DISTINCT FROM 'enviado' OR NEW.tipo NOT LIKE 'recuperacao:%' THEN RETURN NEW; END IF;
 v_envio := TG_OP='INSERT'; v_resposta := NEW.resposta_em IS NOT NULL;
 IF TG_OP='UPDATE' THEN v_envio := OLD.status IS DISTINCT FROM 'enviado'; v_resposta := OLD.resposta_em IS NULL AND NEW.resposta_em IS NOT NULL; END IF;
 IF NOT v_envio AND NOT v_resposta THEN RETURN NEW; END IF;
 UPDATE public.meta_qualidade_recuperacao_ciclos c SET
 primeiro_envio_recuperacao_em=CASE WHEN v_envio THEN least(c.primeiro_envio_recuperacao_em,NEW.enviado_em) ELSE c.primeiro_envio_recuperacao_em END,
 envios_recuperacao_aceitos=c.envios_recuperacao_aceitos+CASE WHEN v_envio THEN 1 ELSE 0 END,
 envios_google_maps_aceitos=c.envios_google_maps_aceitos+CASE WHEN v_envio AND NEW.fonte IN ('confirmado','candidato') THEN 1 ELSE 0 END,
 respostas_recuperacao=c.respostas_recuperacao+CASE WHEN v_resposta THEN 1 ELSE 0 END,
 primeiro_envio_uazapi_em=CASE WHEN v_envio AND (NEW.fonte='uazapi' OR (NOT coalesce(NEW.cadastral,false) AND NEW.destino_instancia_id IS NOT NULL)) THEN least(c.primeiro_envio_uazapi_em,NEW.enviado_em) ELSE c.primeiro_envio_uazapi_em END,
 envios_uazapi_aceitos=c.envios_uazapi_aceitos+CASE WHEN v_envio AND (NEW.fonte='uazapi' OR (NOT coalesce(NEW.cadastral,false) AND NEW.destino_instancia_id IS NOT NULL)) THEN 1 ELSE 0 END,
 atualizado_em=now()
 WHERE c.instancia_id=NEW.instancia_id AND NEW.enviado_em>=c.caiu_em AND (c.voltou_green_em IS NULL OR NEW.enviado_em<=c.voltou_green_em);
 RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER registrar_envio_ciclo_recuperacao_meta_trigger AFTER INSERT OR UPDATE OF status,resposta_em ON public.meta_recuperacao_log FOR EACH ROW EXECUTE FUNCTION public.registrar_envio_ciclo_recuperacao_meta();
REVOKE ALL ON FUNCTION public.registrar_envio_ciclo_recuperacao_meta() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_envio_ciclo_recuperacao_meta() TO service_role;