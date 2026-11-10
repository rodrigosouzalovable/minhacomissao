-- Staff = account provisioned with an application role (sign-up is closed; admins create accounts).
CREATE OR REPLACE FUNCTION public.is_staff_member(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _uid IS NOT NULL AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid)
$$;
REVOKE EXECUTE ON FUNCTION public.is_staff_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff_member(uuid) TO authenticated, service_role;

-- Agreements / installments: the team-wide read stays, but only for provisioned staff.
DROP POLICY IF EXISTS "Usuários autenticados podem ver acordos para pagamentos" ON public.acordos;
CREATE POLICY "Equipe pode ver acordos para pagamentos" ON public.acordos
  FOR SELECT TO authenticated USING (public.is_staff_member(auth.uid()));
DROP POLICY IF EXISTS "Usuários autenticados podem ver parcelas para pagamentos" ON public.pagamentos;
CREATE POLICY "Equipe pode ver parcelas para pagamentos" ON public.pagamentos
  FOR SELECT TO authenticated USING (public.is_staff_member(auth.uid()));

DROP POLICY IF EXISTS "Todos autenticados leem configuracoes_motivacao" ON public.configuracoes_motivacao;
CREATE POLICY "Equipe le configuracoes_motivacao" ON public.configuracoes_motivacao
  FOR SELECT TO authenticated USING (public.is_staff_member(auth.uid()));

DROP POLICY IF EXISTS "objecao_catalogo_select" ON public.objecao_catalogo;
CREATE POLICY "objecao_catalogo_select" ON public.objecao_catalogo
  FOR SELECT TO authenticated USING (public.is_staff_member(auth.uid()));

DROP POLICY IF EXISTS "Auth pode ler pool conversa grupo" ON public.whatsapp_aquecimento_grupo_dialogos_pool;
CREATE POLICY "Equipe pode ler pool conversa grupo" ON public.whatsapp_aquecimento_grupo_dialogos_pool
  FOR SELECT TO authenticated USING (public.is_staff_member(auth.uid()));

DROP POLICY IF EXISTS "Autenticados leem respostas pool" ON public.whatsapp_aquecimento_status_respostas_pool;
CREATE POLICY "Equipe le respostas pool" ON public.whatsapp_aquecimento_status_respostas_pool
  FOR SELECT TO authenticated USING (public.is_staff_member(auth.uid()));

-- Server-only tables (read by edge functions / definer RPCs): administrators only.
DROP POLICY IF EXISTS "Usuarios autenticados veem tarifas Meta" ON public.meta_tarifas_mensagem;
CREATE POLICY "Admins veem tarifas Meta" ON public.meta_tarifas_mensagem
  FOR SELECT TO authenticated USING (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Autenticados podem ver o cache UME" ON public.ume_consultas_cache;
CREATE POLICY "Admins podem ver o cache UME" ON public.ume_consultas_cache
  FOR SELECT TO authenticated USING (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "atc_select_auth" ON public.acionamento_telefone_cpf;

-- AI usage is recorded only by backend functions.
DROP POLICY IF EXISTS "Authenticated can insert ai_usage_log" ON public.ai_usage_log;
REVOKE INSERT, UPDATE, DELETE ON public.ai_usage_log FROM authenticated, anon;

-- Blocked calls: staff can see; only who blocked (or an admin) can remove.
DROP POLICY IF EXISTS "chamadas_bloqueadas_select" ON public.meta_chamadas_bloqueadas;
CREATE POLICY "chamadas_bloqueadas_select" ON public.meta_chamadas_bloqueadas
  FOR SELECT TO authenticated USING (public.is_staff_member(auth.uid()));
DROP POLICY IF EXISTS "chamadas_bloqueadas_delete" ON public.meta_chamadas_bloqueadas;
CREATE POLICY "chamadas_bloqueadas_delete" ON public.meta_chamadas_bloqueadas
  FOR DELETE TO authenticated USING (bloqueado_por = auth.uid() OR public.is_admin_user(auth.uid()));

-- Team-wide due-date / payment RPCs: provisioned staff only.
CREATE OR REPLACE FUNCTION public.alterar_vencimento_parcela_global(p_pagamento_id uuid, p_nova_data date)
 RETURNS pagamentos
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pagamento public.pagamentos%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Faça login para alterar o vencimento.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_staff_member(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para alterar o vencimento.' USING ERRCODE = '42501';
  END IF;

  IF p_nova_data IS NULL THEN
    RAISE EXCEPTION 'Informe uma data de vencimento válida.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_pagamento
  FROM public.pagamentos
  WHERE id = p_pagamento_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parcela não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  IF v_pagamento.status <> 'pendente' THEN
    RAISE EXCEPTION 'Só é possível alterar o vencimento de parcelas pendentes.' USING ERRCODE = '42501';
  END IF;

  PERFORM set_config('app.edicao_pagamento_global', 'sim', true);

  UPDATE public.pagamentos
  SET data_prevista = p_nova_data
  WHERE id = p_pagamento_id
  RETURNING * INTO v_pagamento;

  RETURN v_pagamento;
END;
$function$;

CREATE OR REPLACE FUNCTION public.definir_pagamento_parcela_global(p_pagamento_id uuid, p_pago boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pagamento public.pagamentos%ROWTYPE;
  v_status_acordo text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Faça login para atualizar o pagamento.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_staff_member(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para atualizar o pagamento.' USING ERRCODE = '42501';
  END IF;

  IF p_pago IS NULL THEN
    RAISE EXCEPTION 'Informe o estado do pagamento.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_pagamento
  FROM public.pagamentos
  WHERE id = p_pagamento_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parcela não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  PERFORM 1
  FROM public.acordos
  WHERE id = v_pagamento.acordo_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acordo não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  PERFORM set_config('app.edicao_pagamento_global', 'sim', true);

  UPDATE public.pagamentos
  SET status = CASE WHEN p_pago THEN 'pago' ELSE 'pendente' END,
      data_paga = CASE WHEN p_pago THEN (now() AT TIME ZONE 'America/Sao_Paulo')::date ELSE NULL END
  WHERE id = p_pagamento_id
  RETURNING * INTO v_pagamento;

  IF NOT EXISTS (
    SELECT 1 FROM public.pagamentos
    WHERE acordo_id = v_pagamento.acordo_id
      AND status <> 'pago'
  ) THEN
    UPDATE public.acordos
    SET status = 'concluido'
    WHERE id = v_pagamento.acordo_id;
  ELSE
    UPDATE public.acordos
    SET status = 'ativo'
    WHERE id = v_pagamento.acordo_id
      AND status = 'concluido';
  END IF;

  SELECT status INTO v_status_acordo
  FROM public.acordos
  WHERE id = v_pagamento.acordo_id;

  RETURN jsonb_build_object(
    'pagamento_id', v_pagamento.id,
    'status', v_pagamento.status,
    'data_paga', v_pagamento.data_paga,
    'acordo_id', v_pagamento.acordo_id,
    'status_acordo', v_status_acordo
  );
END;
$function$;

-- Commission integrity for agreements written by non-admin users.
CREATE OR REPLACE FUNCTION public.validar_comissao_acordo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pct numeric;
  v_esperado numeric;
  v_tolerancia numeric;
BEGIN
  -- Backend jobs (no user session) and administrators keep their own values.
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_pct := public.percentual_comissao_por_atraso(NEW.dias_atraso);
    NEW.percentual_comissao := v_pct;
  ELSE
    IF NEW.comissao_total IS NOT DISTINCT FROM OLD.comissao_total
       AND NEW.valor_total IS NOT DISTINCT FROM OLD.valor_total THEN
      RETURN NEW;
    END IF;
    v_pct := COALESCE(NEW.percentual_comissao, 0);
  END IF;

  v_esperado := round(COALESCE(NEW.valor_total, 0) * v_pct / 100, 2);
  v_tolerancia := greatest(1, COALESCE(NEW.parcelas, 1) * 0.01);
  IF NEW.comissao_total IS NULL OR abs(NEW.comissao_total - v_esperado) > v_tolerancia THEN
    NEW.comissao_total := v_esperado;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.validar_comissao_acordo() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS aa_validar_comissao_acordo ON public.acordos;
CREATE TRIGGER aa_validar_comissao_acordo
  BEFORE INSERT OR UPDATE OF comissao_total, valor_total ON public.acordos
  FOR EACH ROW EXECUTE FUNCTION public.validar_comissao_acordo();

-- Legacy UAZAPI inbox media is stored under the contact phone folder.
CREATE OR REPLACE FUNCTION public.can_view_uazapi_inbox_media(_uid uuid, _object_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  v_folder text;
BEGIN
  IF _uid IS NULL OR _uid IS DISTINCT FROM auth.uid() THEN
    RETURN false;
  END IF;
  v_folder := (storage.foldername(_object_name))[1];
  IF v_folder IS NULL OR v_folder !~ '^[0-9]{8,15}$' THEN
    RETURN false;
  END IF;
  IF public.has_inbox_compartilhado(_uid) THEN
    RETURN true;
  END IF;
  RETURN EXISTS (
    SELECT 1
    FROM public.user_whatsapp_instances ui
    JOIN public.whatsapp_mensagens m ON m.instancia_id = ui.id AND m.telefone_remoto = v_folder
    WHERE ui.user_id = _uid
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.can_view_uazapi_inbox_media(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_uazapi_inbox_media(uuid, text) TO authenticated;

-- inbox-media: conversation files only for people who can see that conversation;
-- shared template / quick-reply assets readable by staff, changeable by their uploader.
DROP POLICY IF EXISTS "Auth read inbox-media" ON storage.objects;
CREATE POLICY "Auth read inbox-media" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'inbox-media' AND (
      public.is_admin_user(auth.uid())
      OR ((storage.foldername(name))[1] = ANY (ARRAY['meta-templates', 'quick-replies']) AND public.is_staff_member(auth.uid()))
      OR EXISTS (SELECT 1 FROM public.meta_whatsapp_instances mi
                 WHERE mi.id::text = (storage.foldername(objects.name))[1] AND mi.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.user_whatsapp_instances ui
                 WHERE ui.id::text = (storage.foldername(objects.name))[1] AND ui.user_id = auth.uid())
      OR public.can_upload_inbox_media_for_conversation(auth.uid(), name)
      OR public.can_view_uazapi_inbox_media(auth.uid(), name)
    )
  );

DROP POLICY IF EXISTS "Auth upload inbox-media" ON storage.objects;
CREATE POLICY "Auth upload inbox-media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'inbox-media' AND (
      public.is_admin_user(auth.uid())
      OR ((storage.foldername(name))[1] = ANY (ARRAY['meta-templates', 'quick-replies']) AND public.is_staff_member(auth.uid()))
      OR EXISTS (SELECT 1 FROM public.meta_whatsapp_instances mi
                 WHERE mi.id::text = (storage.foldername(objects.name))[1] AND mi.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.user_whatsapp_instances ui
                 WHERE ui.id::text = (storage.foldername(objects.name))[1] AND ui.user_id = auth.uid())
      OR public.can_upload_inbox_media_for_conversation(auth.uid(), name)
    )
  );

DROP POLICY IF EXISTS "Auth update inbox-media" ON storage.objects;
CREATE POLICY "Auth update inbox-media" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'inbox-media' AND (
      public.is_admin_user(auth.uid())
      OR owner_id = auth.uid()::text
      OR EXISTS (SELECT 1 FROM public.meta_whatsapp_instances mi
                 WHERE mi.id::text = (storage.foldername(objects.name))[1] AND mi.user_id = auth.uid())
      OR public.owns_whatsapp_instance(
           CASE WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN ((storage.foldername(name))[1])::uuid END)
    )
  );

DROP POLICY IF EXISTS "Auth delete inbox-media" ON storage.objects;
CREATE POLICY "Auth delete inbox-media" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'inbox-media' AND (
      public.is_admin_user(auth.uid())
      OR owner_id = auth.uid()::text
      OR EXISTS (SELECT 1 FROM public.meta_whatsapp_instances mi
                 WHERE mi.id::text = (storage.foldername(objects.name))[1] AND mi.user_id = auth.uid())
      OR public.owns_whatsapp_instance(
           CASE WHEN (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN ((storage.foldername(name))[1])::uuid END)
    )
  );