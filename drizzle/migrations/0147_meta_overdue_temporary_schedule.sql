-- lovable-cron-fallback-reviewed: Owner approved temporary one-minute continuation capped at three hours (180 runs/day), awakened daily only with active overdue work and unscheduled after drain; bounded batches avoid edge timeouts.
CREATE OR REPLACE FUNCTION public.meta_atrasados_continuacao(p_iniciar boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_command text; v_job bigint;
BEGIN
 IF p_iniciar THEN UPDATE public.meta_atrasados_config SET ciclo_ate=now()+interval '3 hours' WHERE ativo; END IF;
 SELECT jobid INTO v_job FROM cron.job WHERE jobname='meta-atrasados-continuacao';
 IF NOT EXISTS(SELECT 1 FROM public.meta_atrasados_config WHERE ativo AND ciclo_ate>now()) THEN IF v_job IS NOT NULL THEN PERFORM cron.unschedule(v_job); END IF; RETURN; END IF;
 SELECT command INTO v_command FROM cron.job WHERE jobname='meta-lembrete-tick-diario' AND active;
 IF v_command IS NULL THEN RAISE EXCEPTION 'Agendamento diário original indisponível'; END IF;
 IF v_job IS NULL THEN PERFORM cron.schedule('meta-atrasados-continuacao','* * * * *',replace(v_command,'meta-lembrete-tick','meta-atrasados')); END IF;
END; $$;
REVOKE ALL ON FUNCTION public.meta_atrasados_continuacao(boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.meta_atrasados_continuacao(boolean) TO service_role;
CREATE OR REPLACE FUNCTION public.meta_atrasados_fila_coberta(p_pagamento uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.pagamentos p JOIN public.acordos a ON a.id=p.acordo_id JOIN public.meta_atrasados_config c ON c.ativo AND public.user_can_access_tenant(a.user_id,c.tenant_id) WHERE p.id=p_pagamento AND (now() AT TIME ZONE 'America/Sao_Paulo')::date-p.data_prevista BETWEEN 1 AND 10)
$$;
REVOKE ALL ON FUNCTION public.meta_atrasados_fila_coberta(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.meta_atrasados_fila_coberta(uuid) TO service_role;