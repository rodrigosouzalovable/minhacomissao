CREATE POLICY meta_bm_parceiro_restrito ON public.meta_business_managers AS RESTRICTIVE FOR ALL TO authenticated
USING (
  NOT public.is_parceiro_meta(auth.uid()) OR public.is_admin_user(auth.uid())
  OR criado_por = auth.uid()
  OR (partner_client_id IS NOT NULL AND public.pode_ver_cliente_parceiro(auth.uid(), partner_client_id))
  OR EXISTS (SELECT 1 FROM public.meta_whatsapp_instances i JOIN public.meta_instance_parceiros p ON p.instancia_id = i.id AND p.user_id = auth.uid() WHERE i.meta_bm_id = meta_business_managers.id)
)
WITH CHECK (
  NOT public.is_parceiro_meta(auth.uid()) OR public.is_admin_user(auth.uid())
  OR criado_por = auth.uid()
  OR (partner_client_id IS NOT NULL AND public.pode_ver_cliente_parceiro(auth.uid(), partner_client_id))
);