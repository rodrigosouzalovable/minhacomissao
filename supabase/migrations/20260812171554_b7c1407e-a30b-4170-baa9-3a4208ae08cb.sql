DROP TRIGGER IF EXISTS trg_atribuir_atendente_fila ON public.meta_whatsapp_mensagens;

CREATE OR REPLACE FUNCTION public.atribuir_atendente_rodizio(p_contato_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_folder_id uuid;
  v_tenant_id uuid;
  v_etiqueta_id uuid;
  v_last_ordem integer;
BEGIN
  SELECT c.folder_id, c.tenant_id
    INTO v_folder_id, v_tenant_id
  FROM public.meta_whatsapp_contatos c
  WHERE c.id = p_contato_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    coalesce(v_tenant_id::text, '') || ':' || coalesce(v_folder_id::text, 'default'),
    0
  ));

  SELECT ce.etiqueta_id
    INTO v_etiqueta_id
  FROM public.meta_whatsapp_contato_etiquetas ce
  JOIN public.meta_whatsapp_etiquetas e ON e.id = ce.etiqueta_id
  WHERE ce.contato_id = p_contato_id
    AND e.nome ILIKE 'Atendente:%'
  LIMIT 1;

  IF v_etiqueta_id IS NOT NULL THEN
    RETURN v_etiqueta_id;
  END IF;

  WITH elegiveis AS (
    SELECT DISTINCT f.etiqueta_id, f.ordem
    FROM public.meta_atendimento_fila f
    JOIN public.profiles p ON p.id = f.user_id
    JOIN public.user_permissions up ON up.user_id = p.id
    JOIN public.meta_whatsapp_etiquetas e ON e.id = f.etiqueta_id
    WHERE f.ativo = true
      AND COALESCE(p.ativo, true) = true
      AND up.atende_inbox_meta = true
      AND e.ativa = true
      AND e.nome ILIKE 'Atendente:%'
      AND f.tenant_id = v_tenant_id
      AND (
        (v_folder_id IS NULL AND EXISTS (
          SELECT 1 FROM public.meta_inbox_default_members d WHERE d.user_id = f.user_id
        ))
        OR
        (v_folder_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.meta_inbox_folder_members m
          WHERE m.folder_id = v_folder_id AND m.user_id = f.user_id
        ))
      )
  )
  SELECT el.ordem
    INTO v_last_ordem
  FROM public.meta_whatsapp_contato_etiquetas ce
  JOIN public.meta_whatsapp_contatos c ON c.id = ce.contato_id
  JOIN elegiveis el ON el.etiqueta_id = ce.etiqueta_id
  WHERE c.tenant_id = v_tenant_id
    AND c.folder_id IS NOT DISTINCT FROM v_folder_id
    AND ce.origem = 'auto_atendente'
  ORDER BY ce.criado_em DESC, ce.id DESC
  LIMIT 1;

  WITH elegiveis AS (
    SELECT DISTINCT f.etiqueta_id, f.ordem
    FROM public.meta_atendimento_fila f
    JOIN public.profiles p ON p.id = f.user_id
    JOIN public.user_permissions up ON up.user_id = p.id
    JOIN public.meta_whatsapp_etiquetas e ON e.id = f.etiqueta_id
    WHERE f.ativo = true
      AND COALESCE(p.ativo, true) = true
      AND up.atende_inbox_meta = true
      AND e.ativa = true
      AND e.nome ILIKE 'Atendente:%'
      AND f.tenant_id = v_tenant_id
      AND (
        (v_folder_id IS NULL AND EXISTS (
          SELECT 1 FROM public.meta_inbox_default_members d WHERE d.user_id = f.user_id
        ))
        OR
        (v_folder_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.meta_inbox_folder_members m
          WHERE m.folder_id = v_folder_id AND m.user_id = f.user_id
        ))
      )
  )
  SELECT el.etiqueta_id
    INTO v_etiqueta_id
  FROM elegiveis el
  ORDER BY
    CASE WHEN v_last_ordem IS NULL OR el.ordem > v_last_ordem THEN 0 ELSE 1 END,
    el.ordem,
    el.etiqueta_id
  LIMIT 1;

  IF v_etiqueta_id IS NOT NULL THEN
    INSERT INTO public.meta_whatsapp_contato_etiquetas
      (contato_id, etiqueta_id, origem, tenant_id)
    VALUES
      (p_contato_id, v_etiqueta_id, 'auto_atendente', v_tenant_id)
    ON CONFLICT (contato_id, etiqueta_id) DO NOTHING;
  END IF;

  RETURN v_etiqueta_id;
END;
$$;

REVOKE ALL ON FUNCTION public.atribuir_atendente_rodizio(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.atribuir_atendente_rodizio(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.iago_claim_message(p_contato_id uuid, p_entrada_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contexto jsonb;
  v_processando_em timestamptz;
BEGIN
  IF p_contato_id IS NULL OR nullif(btrim(p_entrada_id), '') IS NULL THEN
    RETURN false;
  END IF;

  SELECT COALESCE(contexto, '{}'::jsonb)
    INTO v_contexto
  FROM public.iago_conversa_estado
  WHERE contato_id = p_contato_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF COALESCE(v_contexto->'entradas_processadas', '[]'::jsonb) ? p_entrada_id THEN
    RETURN false;
  END IF;

  v_processando_em := NULLIF(v_contexto->>'processando_em', '')::timestamptz;
  IF NULLIF(v_contexto->>'processando_entrada_id', '') IS NOT NULL
     AND v_processando_em IS NOT NULL
     AND v_processando_em > now() - interval '2 minutes' THEN
    RETURN false;
  END IF;

  UPDATE public.iago_conversa_estado
  SET contexto = v_contexto || jsonb_build_object(
        'processando_entrada_id', p_entrada_id,
        'processando_em', now()
      ),
      updated_at = now()
  WHERE contato_id = p_contato_id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.iago_finish_message(p_contato_id uuid, p_entrada_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contexto jsonb;
  v_processadas jsonb;
BEGIN
  SELECT COALESCE(contexto, '{}'::jsonb)
    INTO v_contexto
  FROM public.iago_conversa_estado
  WHERE contato_id = p_contato_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_processadas := COALESCE(v_contexto->'entradas_processadas', '[]'::jsonb);
  IF NOT (v_processadas ? p_entrada_id) THEN
    v_processadas := v_processadas || jsonb_build_array(p_entrada_id);
  END IF;

  SELECT COALESCE(jsonb_agg(value), '[]'::jsonb)
    INTO v_processadas
  FROM (
    SELECT value
    FROM jsonb_array_elements(v_processadas) WITH ORDINALITY AS x(value, ord)
    ORDER BY ord DESC
    LIMIT 50
  ) kept;

  v_contexto := (v_contexto - 'processando_entrada_id' - 'processando_em')
    || jsonb_build_object('entradas_processadas', v_processadas);

  UPDATE public.iago_conversa_estado
  SET contexto = v_contexto, updated_at = now()
  WHERE contato_id = p_contato_id;
END;
$$;

REVOKE ALL ON FUNCTION public.iago_claim_message(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.iago_finish_message(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.iago_claim_message(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.iago_finish_message(uuid, text) TO service_role;