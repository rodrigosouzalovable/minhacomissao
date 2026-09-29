CREATE OR REPLACE FUNCTION public.can_upload_inbox_media_for_conversation(_uid uuid, _object_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  v_parts text[];
  v_instance_id uuid;
  v_recipient text;
  v_recipient_digits text;
BEGIN
  IF auth.uid() IS NULL OR _uid IS DISTINCT FROM auth.uid() OR NULLIF(BTRIM(_object_name), '') IS NULL THEN
    RETURN false;
  END IF;

  v_parts := storage.foldername(_object_name);
  IF COALESCE(array_length(v_parts, 1), 0) < 2 THEN
    RETURN false;
  END IF;

  BEGIN
    v_instance_id := v_parts[1]::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN false;
  END;

  v_recipient := NULLIF(BTRIM(v_parts[2]), '');
  IF v_recipient IS NULL THEN
    RETURN false;
  END IF;
  v_recipient_digits := regexp_replace(v_recipient, '\D', '', 'g');

  RETURN EXISTS (
    SELECT 1
    FROM public.meta_whatsapp_contatos c
    WHERE c.instancia_id = v_instance_id
      AND public.can_view_meta_contato_folder(_uid, c.folder_id)
      AND (
        c.bsuid = v_recipient
        OR c.telefone = v_recipient
        OR (
          length(v_recipient_digits) >= 8
          AND right(regexp_replace(COALESCE(c.telefone, ''), '\D', '', 'g'), 8) = right(v_recipient_digits, 8)
        )
      )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.can_upload_inbox_media_for_conversation(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_upload_inbox_media_for_conversation(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_upload_inbox_media_for_conversation(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_upload_inbox_media_for_conversation(uuid, text) TO service_role;