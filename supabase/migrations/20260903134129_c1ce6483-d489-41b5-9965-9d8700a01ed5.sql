DROP FUNCTION IF EXISTS public.meta_mensagens_thread(uuid, text, int, int);

CREATE FUNCTION public.meta_mensagens_thread(_instancia uuid, _suffix text, _limit int DEFAULT 40, _offset int DEFAULT 0)
RETURNS TABLE (
  id uuid,
  instancia_id uuid,
  telefone text,
  conteudo text,
  direcao text,
  timestamp_msg timestamptz,
  tipo_conteudo text,
  media_url text,
  wa_message_id text,
  status_envio text,
  wa_message_id_reply text,
  conteudo_citado text,
  contatos_payload jsonb,
  template_botoes jsonb,
  transcricao text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _autorizado boolean := false;
  _inst_owner uuid;
  _inst_cliente uuid;
BEGIN
  IF _uid IS NULL OR _instancia IS NULL OR _suffix IS NULL THEN
    RETURN;
  END IF;

  SELECT i.user_id, i.partner_client_id
    INTO _inst_owner, _inst_cliente
  FROM public.meta_whatsapp_instances i
  WHERE i.id = _instancia;

  IF _inst_owner IS NULL AND NOT FOUND THEN
    RETURN;
  END IF;

  -- Cliente de parceiro: precisa poder ver o cliente vinculado à instância
  IF _inst_cliente IS NOT NULL
     AND NOT public.pode_ver_cliente_parceiro(_uid, _inst_cliente) THEN
    RETURN;
  END IF;

  IF public.has_role(_uid, 'admin'::app_role)
     OR _inst_owner = _uid
     OR public.has_inbox_compartilhado(_uid) THEN
    _autorizado := true;
  ELSE
    -- Uma única checagem de caixa: existe contato desta thread em caixa acessível
    SELECT EXISTS (
      SELECT 1
      FROM public.meta_whatsapp_contatos c
      WHERE c.instancia_id = _instancia
        AND public.phone_suffix8(c.telefone) = _suffix
        AND public.can_view_meta_contato_folder(_uid, c.folder_id)
    ) INTO _autorizado;
  END IF;

  IF NOT _autorizado THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT m.id, m.instancia_id, m.telefone, m.conteudo, m.direcao, m.timestamp_msg,
         m.tipo_conteudo, m.media_url, m.wa_message_id, m.status_envio,
         m.wa_message_id_reply, m.conteudo_citado,
         m.contatos_payload::jsonb, m.template_botoes::jsonb,
         m.transcricao
  FROM public.meta_whatsapp_mensagens m
  WHERE m.instancia_id = _instancia
    AND public.phone_suffix8(m.telefone) = _suffix
    AND m.apagada_para_mim = false
  ORDER BY m.timestamp_msg DESC
  LIMIT COALESCE(_limit, 40) OFFSET COALESCE(_offset, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.meta_mensagens_thread(uuid, text, int, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.meta_mensagens_thread(uuid, text, int, int) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_meta_msgs_inst_suffix_ts
  ON public.meta_whatsapp_mensagens (instancia_id, public.phone_suffix8(telefone), timestamp_msg DESC);