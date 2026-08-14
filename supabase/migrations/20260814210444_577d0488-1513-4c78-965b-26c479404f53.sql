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
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
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
  LIMIT COALESCE(_limit, 40) OFFSET COALESCE(_offset, 0)
$$;

REVOKE ALL ON FUNCTION public.meta_mensagens_thread(uuid, text, int, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.meta_mensagens_thread(uuid, text, int, int) TO authenticated;