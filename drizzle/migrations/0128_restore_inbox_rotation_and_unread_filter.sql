CREATE OR REPLACE FUNCTION public.meta_etiqueta_atendente_exclusiva()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_nome text;
  v_existente uuid;
BEGIN
  SELECT nome INTO v_nome FROM public.meta_whatsapp_etiquetas WHERE id = NEW.etiqueta_id;
  IF v_nome IS NULL OR v_nome NOT ILIKE 'Atendente:%' THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.contato_id::text, 0));

  SELECT ce.id INTO v_existente
  FROM public.meta_whatsapp_contato_etiquetas ce
  JOIN public.meta_whatsapp_etiquetas e ON e.id = ce.etiqueta_id
  WHERE ce.contato_id = NEW.contato_id
    AND e.nome ILIKE 'Atendente:%'
  FOR UPDATE
  LIMIT 1;

  IF v_existente IS NULL THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.origem, '') = 'auto_atendente' THEN
    RETURN NULL;
  END IF;

  DELETE FROM public.meta_whatsapp_contato_etiquetas ce
  USING public.meta_whatsapp_etiquetas e
  WHERE ce.etiqueta_id = e.id
    AND ce.contato_id = NEW.contato_id
    AND e.nome ILIKE 'Atendente:%';

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.atribuir_atendente_conversa(
  p_contato_id uuid,
  p_etiqueta_preferida uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_folder_id uuid;
  v_folder_key uuid;
  v_tenant_id uuid;
  v_iago_user_id uuid;
  v_etiqueta_id uuid;
  v_ordem integer;
  v_last_ordem integer;
BEGIN
  SELECT c.folder_id, c.tenant_id
    INTO v_folder_id, v_tenant_id
  FROM public.meta_whatsapp_contatos c
  WHERE c.id = p_contato_id
  FOR UPDATE;

  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT user_id INTO v_iago_user_id
  FROM public.iago_config
  WHERE user_id IS NOT NULL
  LIMIT 1;

  SELECT ce.etiqueta_id INTO v_etiqueta_id
  FROM public.meta_whatsapp_contato_etiquetas ce
  JOIN public.meta_whatsapp_etiquetas e ON e.id = ce.etiqueta_id
  JOIN public.meta_atendimento_fila f ON f.etiqueta_id = e.id AND f.tenant_id = v_tenant_id
  JOIN public.profiles p ON p.id = f.user_id
  JOIN public.user_permissions up ON up.user_id = f.user_id
  WHERE ce.contato_id = p_contato_id
    AND e.nome ILIKE 'Atendente:%'
    AND e.ativa = true
    AND f.ativo = true
    AND COALESCE(p.ativo, true) = true
    AND up.atende_inbox_meta = true
    AND (v_folder_id IS NULL OR v_iago_user_id IS NULL OR f.user_id <> v_iago_user_id)
    AND (
      (v_folder_id IS NULL AND EXISTS (
        SELECT 1 FROM public.meta_inbox_default_members d
        WHERE d.user_id = f.user_id AND COALESCE(d.admin, false) = false
      ))
      OR
      (v_folder_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.meta_inbox_folder_members m
        WHERE m.folder_id = v_folder_id AND m.user_id = f.user_id
          AND COALESCE(m.admin, false) = false
      ))
    )
  LIMIT 1;

  IF v_etiqueta_id IS NOT NULL THEN RETURN v_etiqueta_id; END IF;

  DELETE FROM public.meta_whatsapp_contato_etiquetas ce
  USING public.meta_whatsapp_etiquetas e
  WHERE ce.contato_id = p_contato_id
    AND ce.etiqueta_id = e.id
    AND e.nome ILIKE 'Atendente:%';

  IF p_etiqueta_preferida IS NOT NULL THEN
    SELECT f.etiqueta_id, f.ordem INTO v_etiqueta_id, v_ordem
    FROM public.meta_atendimento_fila f
    JOIN public.profiles p ON p.id = f.user_id
    JOIN public.user_permissions up ON up.user_id = f.user_id
    JOIN public.meta_whatsapp_etiquetas e ON e.id = f.etiqueta_id
    WHERE f.etiqueta_id = p_etiqueta_preferida
      AND f.tenant_id = v_tenant_id
      AND f.ativo = true
      AND COALESCE(p.ativo, true) = true
      AND up.atende_inbox_meta = true
      AND e.ativa = true
      AND e.nome ILIKE 'Atendente:%'
      AND (v_folder_id IS NULL OR v_iago_user_id IS NULL OR f.user_id <> v_iago_user_id)
      AND (
        (v_folder_id IS NULL AND EXISTS (
          SELECT 1 FROM public.meta_inbox_default_members d
          WHERE d.user_id = f.user_id AND COALESCE(d.admin, false) = false
        ))
        OR
        (v_folder_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.meta_inbox_folder_members m
          WHERE m.folder_id = v_folder_id AND m.user_id = f.user_id
            AND COALESCE(m.admin, false) = false
        ))
      )
    LIMIT 1;
  END IF;

  v_folder_key := COALESCE(v_folder_id, '00000000-0000-0000-0000-000000000000'::uuid);
  INSERT INTO public.meta_atendimento_rodizio_estado (tenant_id, folder_key)
  VALUES (v_tenant_id, v_folder_key)
  ON CONFLICT (tenant_id, folder_key) DO NOTHING;

  SELECT ultima_ordem INTO v_last_ordem
  FROM public.meta_atendimento_rodizio_estado
  WHERE tenant_id = v_tenant_id AND folder_key = v_folder_key
  FOR UPDATE;

  IF v_etiqueta_id IS NULL THEN
    WITH elegiveis AS (
      SELECT DISTINCT f.etiqueta_id, f.ordem
      FROM public.meta_atendimento_fila f
      JOIN public.profiles p ON p.id = f.user_id
      JOIN public.user_permissions up ON up.user_id = f.user_id
      JOIN public.meta_whatsapp_etiquetas e ON e.id = f.etiqueta_id
      WHERE f.ativo = true
        AND COALESCE(p.ativo, true) = true
        AND up.atende_inbox_meta = true
        AND e.ativa = true
        AND e.nome ILIKE 'Atendente:%'
        AND f.tenant_id = v_tenant_id
        AND (v_folder_id IS NULL OR v_iago_user_id IS NULL OR f.user_id <> v_iago_user_id)
        AND (
          (v_folder_id IS NULL AND EXISTS (
            SELECT 1 FROM public.meta_inbox_default_members d
            WHERE d.user_id = f.user_id AND COALESCE(d.admin, false) = false
          ))
          OR
          (v_folder_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.meta_inbox_folder_members m
            WHERE m.folder_id = v_folder_id AND m.user_id = f.user_id
              AND COALESCE(m.admin, false) = false
          ))
        )
    )
    SELECT el.etiqueta_id, el.ordem INTO v_etiqueta_id, v_ordem
    FROM elegiveis el
    ORDER BY CASE WHEN v_last_ordem IS NULL OR el.ordem > v_last_ordem THEN 0 ELSE 1 END,
      el.ordem, el.etiqueta_id
    LIMIT 1;
  END IF;

  IF v_etiqueta_id IS NULL THEN RETURN NULL; END IF;

  INSERT INTO public.meta_whatsapp_contato_etiquetas
    (contato_id, etiqueta_id, origem, tenant_id)
  VALUES (p_contato_id, v_etiqueta_id, 'auto_atendente', v_tenant_id)
  ON CONFLICT (contato_id, etiqueta_id) DO NOTHING;

  UPDATE public.meta_atendimento_rodizio_estado
  SET ultima_ordem = v_ordem, atualizado_em = now()
  WHERE tenant_id = v_tenant_id AND folder_key = v_folder_key;

  RETURN v_etiqueta_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.atribuir_atendente_conversa(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.atribuir_atendente_conversa(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.meta_inbox_tagged_search_page(
  p_etiquetas uuid[],
  p_qualificacoes uuid[],
  p_busca text,
  p_apenas_nao_lidas boolean,
  p_instancia uuid DEFAULT NULL,
  p_folder uuid DEFAULT NULL,
  p_filtrar_folder boolean DEFAULT true,
  p_arquivado boolean DEFAULT false,
  p_filtrar_arquivado boolean DEFAULT true,
  p_inicio timestamptz DEFAULT NULL,
  p_fim timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 300,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid, instancia_id uuid, telefone text, nome text, nome_perfil text, cpf text,
  ultima_mensagem text, ultima_mensagem_em timestamptz, ultima_msg_entrada_em timestamptz,
  sla_dispensado_em timestamptz, nao_lido integer, fixado boolean, arquivado boolean,
  folder_id uuid, credor text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
 SELECT c.id, c.instancia_id, c.telefone, c.nome, c.nome_perfil, c.cpf, c.ultima_mensagem,
        c.ultima_mensagem_em, c.ultima_msg_entrada_em, c.sla_dispensado_em,
        c.nao_lido, c.fixado, c.arquivado, c.folder_id, c.credor
 FROM public.meta_whatsapp_contatos c
 WHERE auth.uid() IS NOT NULL
   AND cardinality(p_etiquetas) BETWEEN 1 AND 50
   AND EXISTS (
     SELECT 1 FROM public.meta_whatsapp_contato_etiquetas ce
     WHERE ce.contato_id = c.id AND ce.etiqueta_id = ANY(p_etiquetas)
   )
   AND (cardinality(p_qualificacoes) = 0 OR EXISTS (
     SELECT 1 FROM public.meta_contato_qualificacao cq
     WHERE cq.contato_id = c.id AND cq.qualificacao_id = ANY(p_qualificacoes)
   ))
   AND (p_busca IS NULL OR length(trim(p_busca)) = 0 OR
        c.nome_perfil ILIKE '%' || replace(replace(trim(p_busca), '%', '\%'), '_', '\_') || '%' OR
        c.nome ILIKE '%' || replace(replace(trim(p_busca), '%', '\%'), '_', '\_') || '%' OR
        (length(regexp_replace(p_busca, '[^0-9]', '', 'g')) > 0 AND
         c.telefone ILIKE '%' || regexp_replace(p_busca, '[^0-9]', '', 'g') || '%'))
   AND (NOT p_apenas_nao_lidas OR COALESCE(c.nao_lido, 0) > 0)
   AND (p_instancia IS NULL OR c.instancia_id = p_instancia)
   AND (NOT p_filtrar_folder OR c.folder_id IS NOT DISTINCT FROM p_folder)
   AND (NOT p_filtrar_arquivado OR c.arquivado = p_arquivado)
   AND (p_inicio IS NULL OR c.ultima_mensagem_em >= p_inicio)
   AND (p_fim IS NULL OR c.ultima_mensagem_em <= p_fim)
 ORDER BY c.ultima_mensagem_em DESC NULLS LAST, c.id DESC
 LIMIT LEAST(GREATEST(p_limit, 1), 300)
 OFFSET LEAST(GREATEST(p_offset, 0), 100000)
$function$;

GRANT EXECUTE ON FUNCTION public.meta_inbox_tagged_search_page(uuid[], uuid[], text, boolean, uuid, uuid, boolean, boolean, boolean, timestamptz, timestamptz, integer, integer) TO authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_meta_contatos_folder_arq_naolido_ultima
ON public.meta_whatsapp_contatos (folder_id, arquivado, ultima_mensagem_em DESC)
WHERE nao_lido > 0;