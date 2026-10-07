-- lovable-cron-fallback-reviewed: User approved bounded wake-on-daily-work continuation, max three-hour cycle / 180 runs per day, unschedule after drain; no permanent sweeper.
CREATE UNIQUE INDEX IF NOT EXISTS meta_atrasados_agreement_day_active ON public.meta_atrasados_envios(acordo_id,dia_envio) WHERE status IN ('reservado','aceito','incerto');
CREATE OR REPLACE FUNCTION public.meta_atrasados_reservar(p_config uuid,p_pagamento uuid,p_etapa integer,p_vencimento date,p_dia date) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid; v_p public.pagamentos%ROWTYPE; v_a public.acordos%ROWTYPE; v_cfg public.meta_atrasados_config%ROWTYPE;
BEGIN
 SELECT * INTO v_cfg FROM public.meta_atrasados_config WHERE id=p_config AND ativo FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO v_p FROM public.pagamentos WHERE id=p_pagamento AND status='pendente' AND data_prevista=p_vencimento FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO v_a FROM public.acordos WHERE id=v_p.acordo_id AND status='ativo' FOR UPDATE;
 IF NOT FOUND OR NOT public.user_can_access_tenant(v_a.user_id,v_cfg.tenant_id) THEN RETURN NULL; END IF;
 IF p_dia<>(now() AT TIME ZONE 'America/Sao_Paulo')::date OR (p_dia-p_vencimento) NOT BETWEEN 1 AND 10 OR p_etapa<>(CASE WHEN p_dia-p_vencimento>=7 THEN 7 WHEN p_dia-p_vencimento>=3 THEN 3 ELSE 1 END) THEN RETURN NULL; END IF;
 IF EXISTS(SELECT 1 FROM public.meta_atrasados_envios WHERE acordo_id=v_a.id AND dia_envio=p_dia AND status IN ('reservado','aceito','incerto')) THEN RETURN NULL; END IF;
 INSERT INTO public.meta_atrasados_envios(config_id,pagamento_id,acordo_id,vencimento,etapa,dia_envio,user_id,telefone,cliente_nome,status) VALUES(p_config,v_p.id,v_a.id,p_vencimento,p_etapa,p_dia,v_a.user_id,coalesce(v_a.cliente_telefone,''),v_a.cliente_nome,'reservado') ON CONFLICT(pagamento_id,vencimento,etapa) DO UPDATE SET status='reservado',dia_envio=p_dia,atualizado_em=now() WHERE meta_atrasados_envios.status='pendente' RETURNING id INTO v_id;
 RETURN v_id;
EXCEPTION WHEN unique_violation THEN RETURN NULL;
END; $$;
REVOKE ALL ON FUNCTION public.meta_atrasados_reservar(uuid,uuid,integer,date,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.meta_atrasados_reservar(uuid,uuid,integer,date,date) TO service_role;
CREATE OR REPLACE FUNCTION public.meta_atrasados_continuacao(p_iniciar boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_command text; v_job bigint;
BEGIN
 IF p_iniciar THEN UPDATE public.meta_atrasados_config SET ciclo_ate=now()+interval '3 hours' WHERE ativo; END IF;
 SELECT jobid INTO v_job FROM cron.job WHERE jobname='meta-atrasados-continuacao';
 IF NOT EXISTS(SELECT 1 FROM public.meta_atrasados_config WHERE ativo AND ciclo_ate>now()) THEN IF v_job IS NOT NULL THEN PERFORM cron.unschedule(v_job); END IF; RETURN; END IF;
 SELECT command INTO v_command FROM cron.job WHERE jobname='meta-lembrete-tick-diario' AND active;
 IF v_command IS NULL OR strpos(v_command,'meta-lembrete-tick')=0 THEN RAISE EXCEPTION 'Agendamento diário original indisponível ou incompatível'; END IF;
 IF v_job IS NULL THEN PERFORM cron.schedule('meta-atrasados-continuacao','* * * * *',replace(v_command,'meta-lembrete-tick','meta-atrasados')); END IF;
END; $$;
REVOKE ALL ON FUNCTION public.meta_atrasados_continuacao(boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.meta_atrasados_continuacao(boolean) TO service_role;