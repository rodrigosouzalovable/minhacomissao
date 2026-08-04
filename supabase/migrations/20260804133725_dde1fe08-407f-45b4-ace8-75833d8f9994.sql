DROP POLICY IF EXISTS meta_etiquetas_owner_update ON public.meta_whatsapp_etiquetas;
DROP POLICY IF EXISTS meta_etiquetas_owner_delete ON public.meta_whatsapp_etiquetas;

CREATE POLICY meta_etiquetas_owner_update
ON public.meta_whatsapp_etiquetas
FOR UPDATE
TO authenticated
USING (public.is_admin_user(auth.uid()) OR auth.uid() = user_id)
WITH CHECK (public.is_admin_user(auth.uid()) OR auth.uid() = user_id);

CREATE POLICY meta_etiquetas_owner_delete
ON public.meta_whatsapp_etiquetas
FOR DELETE
TO authenticated
USING (
  public.is_admin_user(auth.uid())
  OR (
    auth.uid() = user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.meta_whatsapp_contato_etiquetas ce
      WHERE ce.etiqueta_id = meta_whatsapp_etiquetas.id
        AND ce.origem = 'auto_atendente'
    )
  )
);