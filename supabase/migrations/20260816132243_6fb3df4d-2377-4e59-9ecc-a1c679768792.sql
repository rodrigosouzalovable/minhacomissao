DROP POLICY IF EXISTS "Users manage own meta instances" ON public.meta_whatsapp_instances;
CREATE POLICY "Users manage own meta instances"
ON public.meta_whatsapp_instances
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR auth.uid() = user_id)
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR auth.uid() = user_id);

DROP POLICY IF EXISTS meta_instances_parceiro_select ON public.meta_whatsapp_instances;
CREATE POLICY meta_instances_parceiro_select
ON public.meta_whatsapp_instances
FOR SELECT
TO authenticated
USING (is_parceiro_meta(auth.uid()) AND (parceiro_tem_instancia(auth.uid(), id) OR auth.uid() = user_id));

DROP POLICY IF EXISTS meta_instances_parceiro_update ON public.meta_whatsapp_instances;
CREATE POLICY meta_instances_parceiro_update
ON public.meta_whatsapp_instances
FOR UPDATE
TO authenticated
USING (is_parceiro_meta(auth.uid()) AND (parceiro_tem_instancia(auth.uid(), id) OR auth.uid() = user_id))
WITH CHECK (is_parceiro_meta(auth.uid()) AND (parceiro_tem_instancia(auth.uid(), id) OR auth.uid() = user_id));

DROP POLICY IF EXISTS meta_instances_parceiro_delete ON public.meta_whatsapp_instances;
CREATE POLICY meta_instances_parceiro_delete
ON public.meta_whatsapp_instances
FOR DELETE
TO authenticated
USING (is_parceiro_meta(auth.uid()) AND (parceiro_tem_instancia(auth.uid(), id) OR auth.uid() = user_id));