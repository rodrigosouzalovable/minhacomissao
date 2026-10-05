CREATE OR REPLACE FUNCTION public.can_send_meta_inbox_message(
  _uid uuid,
  _contato_id uuid DEFAULT NULL,
  _instancia_id uuid DEFAULT NULL,
  _recipient text DEFAULT NULL,
  _folder_id uuid DEFAULT NULL,
  _allow_new boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_folder_id uuid;
  v_recipient_digits text;
BEGIN
  IF auth.uid() IS NULL OR _uid IS DISTINCT FROM auth.uid() THEN
    RETURN false;
  END IF;

  IF public.has_role(_uid, 'admin'::public.app_role) THEN
    RETURN true;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_permissions up
    WHERE up.user_id = _uid
      AND up.atende_inbox_meta = true
  ) THEN
    RETURN false;
  END IF;

  IF _contato_id IS NOT NULL THEN
    SELECT c.folder_id
      INTO v_folder_id
    FROM public.meta_whatsapp_contatos c
    WHERE c.id = _contato_id
      AND (_instancia_id IS NULL OR c.instancia_id = _instancia_id);

    IF FOUND THEN
      RETURN CASE
        WHEN v_folder_id IS NULL THEN EXISTS (
          SELECT 1 FROM public.meta_inbox_default_members d WHERE d.user_id = _uid
        )
        ELSE EXISTS (
          SELECT 1 FROM public.meta_inbox_folder_members m
          WHERE m.folder_id = v_folder_id AND m.user_id = _uid
        )
      END;
    END IF;
    RETURN false;
  END IF;

  v_recipient_digits := regexp_replace(COALESCE(_recipient, ''), '\D', '', 'g');
  IF _instancia_id IS NOT NULL AND NULLIF(BTRIM(_recipient), '') IS NOT NULL THEN
    SELECT c.folder_id
      INTO v_folder_id
    FROM public.meta_whatsapp_contatos c
    WHERE c.instancia_id = _instancia_id
      AND (
        c.bsuid = _recipient
        OR c.telefone = _recipient
        OR (
          length(v_recipient_digits) >= 8
          AND right(regexp_replace(COALESCE(c.telefone, ''), '\D', '', 'g'), 8) = right(v_recipient_digits, 8)
        )
      )
    ORDER BY c.atualizado_em DESC NULLS LAST
    LIMIT 1;

    IF FOUND THEN
      RETURN CASE
        WHEN v_folder_id IS NULL THEN EXISTS (
          SELECT 1 FROM public.meta_inbox_default_members d WHERE d.user_id = _uid
        )
        ELSE EXISTS (
          SELECT 1 FROM public.meta_inbox_folder_members m
          WHERE m.folder_id = v_folder_id AND m.user_id = _uid
        )
      END;
    END IF;
  END IF;

  IF NOT _allow_new THEN
    RETURN false;
  END IF;

  RETURN CASE
    WHEN _folder_id IS NULL THEN EXISTS (
      SELECT 1 FROM public.meta_inbox_default_members d WHERE d.user_id = _uid
    )
    ELSE EXISTS (
      SELECT 1 FROM public.meta_inbox_folder_members m
      WHERE m.folder_id = _folder_id AND m.user_id = _uid
    )
  END;
END;
$$;