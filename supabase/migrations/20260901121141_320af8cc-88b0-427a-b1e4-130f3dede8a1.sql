DROP POLICY IF EXISTS meta_instances_cliente_parceiro_select ON public.meta_whatsapp_instances;
DROP POLICY IF EXISTS meta_instances_cliente_parceiro_update ON public.meta_whatsapp_instances;

CREATE POLICY meta_instances_cliente_parceiro_select
ON public.meta_whatsapp_instances
FOR SELECT
TO authenticated
USING (partner_client_id IS NOT NULL AND public.pode_ver_cliente_parceiro(auth.uid(), partner_client_id));

CREATE POLICY meta_instances_cliente_parceiro_update
ON public.meta_whatsapp_instances
FOR UPDATE
TO authenticated
USING (partner_client_id IS NOT NULL AND public.pode_ver_cliente_parceiro(auth.uid(), partner_client_id))
WITH CHECK (partner_client_id IS NOT NULL AND public.pode_ver_cliente_parceiro(auth.uid(), partner_client_id));