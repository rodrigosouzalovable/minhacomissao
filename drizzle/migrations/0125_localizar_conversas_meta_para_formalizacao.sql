CREATE OR REPLACE FUNCTION public.localizar_conversas_meta_por_telefone(_telefone text)
RETURNS TABLE (
  contato_id uuid,
  instancia_id uuid,
  telefone text,
  bsuid text,
  contato_nome text,
  instancia_nome text,
  ultima_mensagem_em timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id AS contato_id,
    c.instancia_id,
    c.telefone,
    c.bsuid,
    COALESCE(c.nome_perfil, c.nome) AS contato_nome,
    COALESCE(i.nome, 'WhatsApp Oficial') AS instancia_nome,
    c.ultima_mensagem_em
  FROM public.meta_whatsapp_contatos c
  JOIN public.meta_whatsapp_instances i ON i.id = c.instancia_id
  WHERE auth.uid() IS NOT NULL
    AND public.phone_suffix8(_telefone) IS NOT NULL
    AND public.phone_suffix8(c.telefone) = public.phone_suffix8(_telefone)
    AND i.ativo = true
    AND public.can_view_meta_contato_folder(auth.uid(), c.folder_id)
  ORDER BY c.ultima_mensagem_em DESC NULLS LAST, c.atualizado_em DESC
  LIMIT 20;
$$;

REVOKE ALL ON FUNCTION public.localizar_conversas_meta_por_telefone(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.localizar_conversas_meta_por_telefone(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.localizar_conversas_meta_por_telefone(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.localizar_conversas_meta_por_telefone(text) TO service_role;