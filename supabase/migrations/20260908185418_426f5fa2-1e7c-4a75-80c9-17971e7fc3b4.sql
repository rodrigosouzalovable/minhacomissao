CREATE POLICY "supressao_delete_parceiro_instancia"
ON public.meta_destinatario_supressao
FOR DELETE
TO authenticated
USING (
  instancia_id IS NOT NULL
  AND public.pode_ver_instancia_meta(auth.uid(), instancia_id)
);