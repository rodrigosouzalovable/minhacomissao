CREATE OR REPLACE FUNCTION public.nm_reservation_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE i public.meta_whatsapp_instances%ROWTYPE; v_limit integer; v_recovery bigint; v_quota record;
BEGIN
 IF NEW.fonte IS DISTINCT FROM 'novo_mundo' THEN RETURN NEW; END IF;
 SELECT * INTO i FROM public.meta_whatsapp_instances WHERE id=NEW.instancia_id;
 IF i.quarentena_ate>now() OR coalesce(i.saude_status,'')<>'CONNECTED' OR NOT EXISTS(SELECT 1 FROM public.meta_novo_mundo_config WHERE user_id=i.user_id AND ativo AND lease_ate>now()) OR NOT EXISTS(SELECT 1 FROM public.meta_recuperacao_cadastral_config WHERE user_id=i.user_id AND ativo AND custo_autorizado_em IS NOT NULL) THEN RAISE EXCEPTION 'Remetente em quarentena ou recuperação não autorizada'; END IF;
 IF i.meta_bm_id IS NOT NULL THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('nm-bm:'||i.meta_bm_id,0));
  SELECT * INTO v_quota FROM public.meta_bm_uso_24h() WHERE bm_id=i.meta_bm_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cota da BM não confirmada'; END IF;
  SELECT count(*) INTO v_recovery FROM public.meta_recuperacao_log l JOIN public.meta_whatsapp_instances x ON x.id=l.instancia_id WHERE x.meta_bm_id=i.meta_bm_id AND l.enviado_em>now()-interval '24 hours';
  IF NOT v_quota.tier_ilimitado AND v_quota.enviados_24h+v_recovery>=v_quota.tier_diario THEN RAISE EXCEPTION 'Cota da BM esgotada; aguardando janela disponível'; END IF;
 ELSE
  v_limit:=public.meta_tier_valor(coalesce(i.messaging_limit_manual,i.saude_tier));
  IF v_limit IS NULL OR v_limit<=0 THEN RAISE EXCEPTION 'Cota do número não confirmada'; END IF;
  IF (SELECT count(*) FROM public.meta_recuperacao_log WHERE instancia_id=i.id AND enviado_em>now()-interval '24 hours')+(SELECT count(*) FROM public.meta_whatsapp_envios_log WHERE instancia_id=i.id AND enviado_em>now()-interval '24 hours' AND coalesce(status,'')<>'failed')>=v_limit THEN RAISE EXCEPTION 'Cota do número esgotada'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE INDEX nm_recovery_instance_time ON public.meta_recuperacao_log(instancia_id,enviado_em);