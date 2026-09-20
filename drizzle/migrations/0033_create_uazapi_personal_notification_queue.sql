ALTER TABLE public.admin_notificacoes_config
  ADD COLUMN IF NOT EXISTS proxima_notificacao_em timestamptz;

CREATE TABLE public.admin_notificacao_instancias (
  instancia_id uuid PRIMARY KEY REFERENCES public.user_whatsapp_instances(id) ON DELETE CASCADE,
  ativa boolean NOT NULL DEFAULT true,
  ativada_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  criada_em timestamptz NOT NULL DEFAULT now(),
  atualizada_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_notificacao_instancias TO authenticated;
GRANT ALL ON public.admin_notificacao_instancias TO service_role;
ALTER TABLE public.admin_notificacao_instancias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins gerenciam remetentes de notificacoes"
  ON public.admin_notificacao_instancias
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE public.admin_notificacao_instancias_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instancia_id uuid REFERENCES public.user_whatsapp_instances(id) ON DELETE SET NULL,
  ativa boolean NOT NULL,
  alterada_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  alterada_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_notificacao_instancias_auditoria TO authenticated;
GRANT ALL ON public.admin_notificacao_instancias_auditoria TO service_role;
ALTER TABLE public.admin_notificacao_instancias_auditoria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins veem auditoria dos remetentes"
  ON public.admin_notificacao_instancias_auditoria
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE public.admin_notificacoes_fila (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  chave_idempotencia text,
  destinatario text NOT NULL,
  mensagem text NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'processando', 'enviado', 'erro')),
  agendada_para timestamptz NOT NULL,
  tentativas integer NOT NULL DEFAULT 0,
  instancia_envio_id uuid REFERENCES public.user_whatsapp_instances(id) ON DELETE SET NULL,
  fallback boolean NOT NULL DEFAULT false,
  erro_detalhe text,
  criada_em timestamptz NOT NULL DEFAULT now(),
  processada_em timestamptz
);
GRANT SELECT ON public.admin_notificacoes_fila TO authenticated;
GRANT ALL ON public.admin_notificacoes_fila TO service_role;
ALTER TABLE public.admin_notificacoes_fila ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins veem fila de notificacoes"
  ON public.admin_notificacoes_fila
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE INDEX admin_notificacoes_fila_pendentes_idx
  ON public.admin_notificacoes_fila (agendada_para, criada_em)
  WHERE status = 'pendente';
CREATE UNIQUE INDEX admin_notificacoes_fila_idempotencia_idx
  ON public.admin_notificacoes_fila (tipo, chave_idempotencia, destinatario)
  WHERE chave_idempotencia IS NOT NULL;

CREATE OR REPLACE FUNCTION public.definir_instancia_notificacao_uazapi(
  p_instancia_id uuid,
  p_ativa boolean
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar os remetentes de notificações';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_whatsapp_instances WHERE id = p_instancia_id) THEN
    RAISE EXCEPTION 'Instância não encontrada';
  END IF;

  INSERT INTO public.admin_notificacao_instancias (instancia_id, ativa, ativada_por, atualizada_em)
  VALUES (p_instancia_id, p_ativa, auth.uid(), now())
  ON CONFLICT (instancia_id) DO UPDATE
    SET ativa = EXCLUDED.ativa,
        ativada_por = EXCLUDED.ativada_por,
        atualizada_em = now();

  INSERT INTO public.admin_notificacao_instancias_auditoria (instancia_id, ativa, alterada_por)
  VALUES (p_instancia_id, p_ativa, auth.uid());
  RETURN p_ativa;
END;
$$;
REVOKE ALL ON FUNCTION public.definir_instancia_notificacao_uazapi(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_instancia_notificacao_uazapi(uuid, boolean) TO authenticated, service_role;

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
  v_base timestamptz;
  v_agendada timestamptz;
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

  SELECT max(f.agendada_para) INTO v_base
    FROM public.admin_notificacoes_fila f
    WHERE f.status IN ('pendente', 'processando');

  IF v_base IS NULL OR v_base < now() THEN
    v_agendada := now();
  ELSE
    v_agendada := v_base + make_interval(secs => (30 + floor(random() * 31))::integer);
  END IF;

  INSERT INTO public.admin_notificacoes_fila (tipo, chave_idempotencia, destinatario, mensagem, agendada_para)
  VALUES (p_tipo, p_chave_idempotencia, p_destinatario, p_mensagem, v_agendada)
  RETURNING admin_notificacoes_fila.id INTO v_id;

  UPDATE public.admin_notificacoes_config
    SET proxima_notificacao_em = v_agendada, updated_at = now()
    WHERE admin_notificacoes_config.id = 1;

  RETURN QUERY SELECT v_id, v_agendada, true;
END;
$$;
REVOKE ALL ON FUNCTION public.enfileirar_notificacao_admin(text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enfileirar_notificacao_admin(text, text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.reivindicar_notificacao_admin(p_id uuid)
RETURNS SETOF public.admin_notificacoes_fila
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Acesso restrito ao serviço interno';
  END IF;
  RETURN QUERY
  UPDATE public.admin_notificacoes_fila f
     SET status = 'processando', tentativas = tentativas + 1
   WHERE f.id = p_id
     AND f.status = 'pendente'
     AND f.agendada_para <= now() + interval '1 second'
  RETURNING f.*;
END;
$$;
REVOKE ALL ON FUNCTION public.reivindicar_notificacao_admin(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reivindicar_notificacao_admin(uuid) TO service_role;

INSERT INTO public.admin_notificacao_instancias (instancia_id, ativa)
SELECT instancia_notificacao_id, true
FROM public.admin_notificacoes_config
WHERE id = 1 AND instancia_notificacao_id IS NOT NULL
ON CONFLICT (instancia_id) DO NOTHING;