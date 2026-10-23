ALTER TABLE public.admin_notificacoes_fila DROP CONSTRAINT admin_notificacoes_fila_status_check;
ALTER TABLE public.admin_notificacoes_fila ADD CONSTRAINT admin_notificacoes_fila_status_check CHECK (status = ANY (ARRAY['pendente','processando','enviado','erro','pausado','expirado']));

CREATE OR REPLACE FUNCTION public.finalizar_notificacao_admin(p_id uuid, p_status text, p_instancia_id uuid DEFAULT NULL::uuid, p_fallback boolean DEFAULT false, p_erro text DEFAULT NULL::text)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_delay integer := 30 + floor(random() * 31)::integer;
  v_proxima uuid;
BEGIN
  IF p_status NOT IN ('enviado', 'erro', 'pausado', 'expirado') THEN RAISE EXCEPTION 'Status inválido'; END IF;
  -- Itens descartados não consomem o intervalo entre mensagens
  IF p_status IN ('pausado','expirado') THEN v_delay := 1; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('admin_notificacoes_processador_global'));
  UPDATE public.admin_notificacoes_fila SET status = p_status, instancia_envio_id = p_instancia_id,
    fallback = p_fallback, erro_detalhe = left(p_erro, 4000), processada_em = now() WHERE id = p_id;
  SELECT f.id INTO v_proxima FROM public.admin_notificacoes_fila f WHERE f.status = 'pendente' ORDER BY f.criada_em LIMIT 1;
  IF v_proxima IS NOT NULL THEN
    UPDATE public.admin_notificacoes_fila SET agendada_para = now() + make_interval(secs => v_delay) WHERE id = v_proxima;
  END IF;
  UPDATE public.admin_notificacoes_config SET fila_processando_id = NULL,
    fila_processando_ate = CASE WHEN v_proxima IS NULL THEN NULL ELSE now() + make_interval(secs => v_delay) END,
    proxima_notificacao_em = CASE WHEN v_proxima IS NULL THEN NULL ELSE now() + make_interval(secs => v_delay) END,
    updated_at = now() WHERE id = 1;
  RETURN CASE WHEN v_proxima IS NULL THEN 0 ELSE v_delay END;
END;
$function$;

UPDATE public.admin_notificacoes_fila SET status='expirado', processada_em=now(), erro_detalhe='Descartado: aviso atrasado'
WHERE status IN ('pendente','processando');

UPDATE public.admin_notificacoes_config SET fila_processando_id=NULL, fila_processando_ate=NULL, proxima_notificacao_em=NULL,
  tipos_permitidos=NULL, notificacoes_pausadas=false, updated_at=now() WHERE id=1;