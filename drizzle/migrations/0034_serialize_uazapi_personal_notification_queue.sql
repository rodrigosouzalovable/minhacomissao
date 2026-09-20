ALTER TABLE public.admin_notificacoes_config
  ADD COLUMN IF NOT EXISTS fila_processando_ate timestamptz,
  ADD COLUMN IF NOT EXISTS fila_processando_id uuid REFERENCES public.admin_notificacoes_fila(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.enfileirar_notificacao_admin(
  p_tipo text,
  p_chave_idempotencia text,
  p_destinatario text,
  p_mensagem text
) RETURNS TABLE(id uuid, agendada_para timestamptz, criada boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existente public.admin_notificacoes_fila%ROWTYPE;
  v_id uuid;
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Acesso restrito ao serviço interno';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('admin_notificacoes_fila_global'));
  IF p_chave_idempotencia IS NOT NULL THEN
    SELECT * INTO v_existente
      FROM public.admin_notificacoes_fila f
      WHERE f.tipo = p_tipo
        AND f.chave_idempotencia = p_chave_idempotencia
        AND f.destinatario = p_destinatario
      LIMIT 1;
    IF FOUND THEN
      RETURN QUERY SELECT v_existente.id, v_existente.agendada_para, false;
      RETURN;
    END IF;
  END IF;
  INSERT INTO public.admin_notificacoes_fila (tipo, chave_idempotencia, destinatario, mensagem, agendada_para)
  VALUES (p_tipo, p_chave_idempotencia, p_destinatario, p_mensagem, now())
  RETURNING admin_notificacoes_fila.id INTO v_id;
  RETURN QUERY SELECT v_id, now(), true;
END;
$$;

CREATE OR REPLACE FUNCTION public.reivindicar_proxima_notificacao_admin()
RETURNS SETOF public.admin_notificacoes_fila
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Acesso restrito ao serviço interno';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('admin_notificacoes_processador_global'));
  IF EXISTS (
    SELECT 1 FROM public.admin_notificacoes_config
    WHERE id = 1 AND fila_processando_ate > now()
  ) THEN
    RETURN;
  END IF;
  SELECT f.id INTO v_id
    FROM public.admin_notificacoes_fila f
    WHERE f.status = 'pendente' AND f.agendada_para <= now()
    ORDER BY f.agendada_para, f.criada_em
    FOR UPDATE SKIP LOCKED
    LIMIT 1;
  IF v_id IS NULL THEN RETURN; END IF;
  UPDATE public.admin_notificacoes_fila
    SET status = 'processando', tentativas = tentativas + 1
    WHERE admin_notificacoes_fila.id = v_id;
  UPDATE public.admin_notificacoes_config
    SET fila_processando_id = v_id,
        fila_processando_ate = now() + interval '90 seconds',
        updated_at = now()
    WHERE id = 1;
  RETURN QUERY SELECT * FROM public.admin_notificacoes_fila WHERE admin_notificacoes_fila.id = v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.reivindicar_proxima_notificacao_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reivindicar_proxima_notificacao_admin() TO service_role;

CREATE OR REPLACE FUNCTION public.finalizar_notificacao_admin(
  p_id uuid,
  p_status text,
  p_instancia_id uuid DEFAULT NULL,
  p_fallback boolean DEFAULT false,
  p_erro text DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delay integer := 30 + floor(random() * 31)::integer;
  v_proxima uuid;
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Acesso restrito ao serviço interno';
  END IF;
  IF p_status NOT IN ('enviado', 'erro') THEN RAISE EXCEPTION 'Status inválido'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('admin_notificacoes_processador_global'));
  UPDATE public.admin_notificacoes_fila
    SET status = p_status,
        instancia_envio_id = p_instancia_id,
        fallback = p_fallback,
        erro_detalhe = left(p_erro, 4000),
        processada_em = now()
    WHERE id = p_id;
  SELECT f.id INTO v_proxima
    FROM public.admin_notificacoes_fila f
    WHERE f.status = 'pendente'
    ORDER BY f.criada_em
    LIMIT 1;
  IF v_proxima IS NOT NULL THEN
    UPDATE public.admin_notificacoes_fila SET agendada_para = now() + make_interval(secs => v_delay) WHERE id = v_proxima;
  END IF;
  UPDATE public.admin_notificacoes_config
    SET fila_processando_id = NULL,
        fila_processando_ate = CASE WHEN v_proxima IS NULL THEN NULL ELSE now() + make_interval(secs => v_delay) END,
        proxima_notificacao_em = CASE WHEN v_proxima IS NULL THEN NULL ELSE now() + make_interval(secs => v_delay) END,
        updated_at = now()
    WHERE id = 1;
  RETURN CASE WHEN v_proxima IS NULL THEN 0 ELSE v_delay END;
END;
$$;
REVOKE ALL ON FUNCTION public.finalizar_notificacao_admin(uuid, text, uuid, boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalizar_notificacao_admin(uuid, text, uuid, boolean, text) TO service_role;

CREATE OR REPLACE FUNCTION public.liberar_trava_notificacao_admin()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.admin_notificacoes_config
  SET fila_processando_id = NULL, fila_processando_ate = NULL, updated_at = now()
  WHERE id = 1 AND fila_processando_ate <= now();
$$;
REVOKE ALL ON FUNCTION public.liberar_trava_notificacao_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.liberar_trava_notificacao_admin() TO service_role;