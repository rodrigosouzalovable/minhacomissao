CREATE OR REPLACE FUNCTION public.meta_inbox_nao_cliente_contatos(_contato_ids uuid[])
RETURNS TABLE (contato_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT c.id
  FROM public.meta_whatsapp_contatos c
  WHERE c.id = ANY(coalesce(_contato_ids, ARRAY[]::uuid[]))
    AND public.can_access_meta_folder(auth.uid(), c.folder_id)
    AND EXISTS (
      SELECT 1
      FROM public.meta_destinatario_supressao s
      WHERE s.telefone_sufixo = right(regexp_replace(coalesce(c.telefone, ''), '\D', '', 'g'), 8)
        AND s.motivo = 'blacklist: não é o cliente'
    );
$$;

REVOKE ALL ON FUNCTION public.meta_inbox_nao_cliente_contatos(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.meta_inbox_nao_cliente_contatos(uuid[]) TO authenticated;