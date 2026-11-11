CREATE OR REPLACE FUNCTION public.can_view_meta_webhook_media(_object_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_parts text[];
  v_inst uuid;
  v_stem text;
  m record;
  v_folder uuid;
  v_partner uuid;
  v_owner uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;
  v_parts := storage.foldername(_object_name);
  IF COALESCE(array_length(v_parts, 1), 0) <> 2 OR v_parts[1] <> 'meta' THEN RETURN false; END IF;
  BEGIN v_inst := v_parts[2]::uuid; EXCEPTION WHEN invalid_text_representation THEN RETURN false; END;
  v_stem := regexp_replace(storage.filename(_object_name), '\.[^.]+$', '');
  IF NULLIF(v_stem, '') IS NULL THEN RETURN false; END IF;

  SELECT mm.user_id, mm.telefone, mm.tenant_id INTO m
  FROM public.meta_whatsapp_mensagens mm
  WHERE mm.instancia_id = v_inst AND mm.wa_message_id = v_stem
  LIMIT 1;
  IF NOT FOUND THEN
    SELECT mm.user_id, mm.telefone, mm.tenant_id INTO m
    FROM public.meta_whatsapp_mensagens mm
    WHERE mm.instancia_id = v_inst AND mm.media_url IS NOT NULL
      AND regexp_replace(COALESCE(mm.wa_message_id, ''), '[^a-zA-Z0-9._-]', '_', 'g') = v_stem
    LIMIT 1;
    IF NOT FOUND THEN RETURN false; END IF;
  END IF;

  IF public.is_admin_user(v_uid) OR m.user_id = v_uid THEN RETURN true; END IF;

  SELECT i.partner_client_id, i.user_id INTO v_partner, v_owner FROM public.meta_whatsapp_instances i WHERE i.id = v_inst;
  IF v_owner = v_uid THEN RETURN true; END IF;
  IF v_partner IS NOT NULL AND NOT public.pode_ver_cliente_parceiro(v_uid, v_partner) THEN RETURN false; END IF;

  SELECT c.folder_id INTO v_folder FROM public.meta_whatsapp_contatos c
  WHERE c.instancia_id = v_inst AND c.telefone IS NOT DISTINCT FROM m.telefone LIMIT 1;

  IF v_folder IS NOT NULL THEN
    RETURN public.can_access_meta_folder(v_uid, v_folder) OR public.can_view_meta_contato_folder(v_uid, v_folder);
  END IF;
  RETURN public.has_inbox_compartilhado(v_uid) OR public.can_view_meta_contato_folder(v_uid, NULL);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.can_view_meta_webhook_media(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_meta_webhook_media(text) TO authenticated;