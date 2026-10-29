DROP FUNCTION IF EXISTS public.meta_inbox_nao_lidas_count();
CREATE OR REPLACE FUNCTION public.meta_inbox_nao_lidas_count(_instancia_ids uuid[])
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE WHEN public.can_view_meta_contato_folder(auth.uid(), NULL) THEN (
    SELECT count(*)::int
    FROM public.meta_whatsapp_contatos c
    WHERE c.instancia_id = ANY(_instancia_ids)
      AND c.arquivado = false AND c.folder_id IS NULL AND c.nao_lido > 0
  ) ELSE 0 END
$$;
REVOKE ALL ON FUNCTION public.meta_inbox_nao_lidas_count(uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.meta_inbox_nao_lidas_count(uuid[]) TO authenticated;