-- Partial index so incoming Meta media (stored as meta/<instance>/<message id>.<ext>) maps back to its message cheaply.
CREATE INDEX IF NOT EXISTS idx_meta_mensagens_midia_wamid_seguro
  ON public.meta_whatsapp_mensagens (instancia_id, (regexp_replace(COALESCE(wa_message_id, ''), '[^a-zA-Z0-9._-]', '_', 'g')))
  WHERE media_url IS NOT NULL;

-- SECURITY INVOKER on purpose: the caller's own message visibility rules decide access.
CREATE OR REPLACE FUNCTION public.can_view_meta_webhook_media(_object_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, storage
AS $$
DECLARE
  v_parts text[];
  v_inst uuid;
  v_stem text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  v_parts := storage.foldername(_object_name);
  IF COALESCE(array_length(v_parts, 1), 0) <> 2 OR v_parts[1] <> 'meta' THEN RETURN false; END IF;
  BEGIN
    v_inst := v_parts[2]::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN false;
  END;
  v_stem := regexp_replace(storage.filename(_object_name), '\.[^.]+$', '');
  IF NULLIF(v_stem, '') IS NULL THEN RETURN false; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.meta_whatsapp_mensagens m
    WHERE m.instancia_id = v_inst
      AND m.media_url IS NOT NULL
      AND regexp_replace(COALESCE(m.wa_message_id, ''), '[^a-zA-Z0-9._-]', '_', 'g') = v_stem
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.can_view_meta_webhook_media(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_meta_webhook_media(text) TO authenticated;

-- UAZAPI inbox media: phone-folder files and <instance>/<phone> uploads for shared-inbox users.
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
  IF v_folder IS NULL THEN
    RETURN false;
  END IF;
  IF v_folder ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN public.has_inbox_compartilhado(_uid)
       AND EXISTS (SELECT 1 FROM public.user_whatsapp_instances ui WHERE ui.id = v_folder::uuid);
  END IF;
  IF v_folder !~ '^[0-9]{8,15}$' THEN
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
      OR public.can_view_meta_webhook_media(name)
      OR public.can_view_uazapi_inbox_media(auth.uid(), name)
    )
  );