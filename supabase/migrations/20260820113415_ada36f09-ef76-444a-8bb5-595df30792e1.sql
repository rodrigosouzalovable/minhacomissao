CREATE OR REPLACE FUNCTION public.meta_fila_status_caixa(_folder uuid DEFAULT NULL::uuid)
RETURNS TABLE(user_id uuid, na_fila boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT p.id AS user_id,
         (EXISTS (
            SELECT 1
            FROM public.meta_atendimento_fila f
            JOIN public.meta_whatsapp_etiquetas e ON e.id = f.etiqueta_id
            WHERE f.ativo = true
              AND lower(btrim(e.nome)) = lower('Atendente: ' || btrim(p.nome))
         )
          AND COALESCE((
            SELECT up.atende_inbox_meta FROM public.user_permissions up WHERE up.user_id = p.id
          ), false) = true) AS na_fila
  FROM public.profiles p
  WHERE (
    (_folder IS NOT NULL AND EXISTS (
       SELECT 1 FROM public.meta_inbox_folder_members m
       WHERE m.folder_id = _folder AND m.user_id = p.id))
    OR
    (_folder IS NULL AND EXISTS (
       SELECT 1 FROM public.meta_inbox_default_members d WHERE d.user_id = p.id))
  )
  AND (
    CASE WHEN _folder IS NULL
      THEN public.meta_inbox_default_can_manage(auth.uid())
      ELSE public.meta_inbox_folder_can_manage(auth.uid(), _folder)
    END
  );
$function$;

REVOKE ALL ON FUNCTION public.meta_fila_status_caixa(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.meta_fila_status_caixa(uuid) TO authenticated;