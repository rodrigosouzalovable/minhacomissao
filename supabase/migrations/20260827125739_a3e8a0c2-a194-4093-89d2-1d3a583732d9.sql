CREATE OR REPLACE FUNCTION public.atribuir_atendente_rodizio(p_contato_id uuid, p_somente_ia boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_folder_id uuid;
  v_folder_key uuid;
  v_tenant_id uuid;
  v_etiqueta_id uuid;
  v_etiqueta_nome text;
  v_ordem integer;
  v_last_ordem integer;
  v_tem_nao_admin boolean;
BEGIN
  SELECT c.folder_id, c.tenant_id
    INTO v_folder_id, v_tenant_id
  FROM public.meta_whatsapp_contatos c
  WHERE c.id = p_contato_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_folder_key := COALESCE(v_folder_id, '00000000-0000-0000-0000-000000000000'::uuid);

  INSERT INTO public.meta_atendimento_rodizio_estado (tenant_id, folder_key)
  VALUES (v_tenant_id, v_folder_key)
  ON CONFLICT (tenant_id, folder_key) DO NOTHING;

  SELECT ultima_ordem
    INTO v_last_ordem
  FROM public.meta_atendimento_rodizio_estado
  WHERE tenant_id = v_tenant_id AND folder_key = v_folder_key
  FOR UPDATE;

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

  -- A caixa tem ao menos um responsável que NÃO é admin da caixa?
  IF v_folder_id IS NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.meta_inbox_default_members d
      WHERE COALESCE(d.admin, false) = false
    ) INTO v_tem_nao_admin;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM public.meta_inbox_folder_members m
      WHERE m.folder_id = v_folder_id AND COALESCE(m.admin, false) = false
    ) INTO v_tem_nao_admin;
  END IF;

  WITH elegiveis AS (
    SELECT DISTINCT f.etiqueta_id, f.ordem, e.nome
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
          SELECT 1 FROM public.meta_inbox_default_members d
          WHERE d.user_id = f.user_id
            AND (NOT v_tem_nao_admin OR COALESCE(d.admin, false) = false)
        ))
        OR
        (v_folder_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.meta_inbox_folder_members m
          WHERE m.folder_id = v_folder_id AND m.user_id = f.user_id
            AND (NOT v_tem_nao_admin OR COALESCE(m.admin, false) = false)
        ))
      )
  )
  SELECT el.etiqueta_id, el.ordem, el.nome
    INTO v_etiqueta_id, v_ordem, v_etiqueta_nome
  FROM elegiveis el
  ORDER BY
    CASE WHEN v_last_ordem IS NULL OR el.ordem > v_last_ordem THEN 0 ELSE 1 END,
    el.ordem,
    el.etiqueta_id
  LIMIT 1;

  IF v_etiqueta_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.meta_atendimento_rodizio_estado
  SET ultima_ordem = v_ordem, atualizado_em = now()
  WHERE tenant_id = v_tenant_id AND folder_key = v_folder_key;

  IF p_somente_ia AND v_etiqueta_nome NOT ILIKE 'Atendente: IAGO%' THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.meta_whatsapp_contato_etiquetas
    (contato_id, etiqueta_id, origem, tenant_id)
  VALUES
    (p_contato_id, v_etiqueta_id, 'auto_atendente', v_tenant_id)
  ON CONFLICT (contato_id, etiqueta_id) DO NOTHING;

  RETURN v_etiqueta_id;
END;
$function$;