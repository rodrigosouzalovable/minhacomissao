DROP POLICY IF EXISTS "Users manage templates of own instances" ON public.meta_whatsapp_templates;
CREATE POLICY "Users manage templates of own instances" ON public.meta_whatsapp_templates FOR ALL
USING (EXISTS (SELECT 1 FROM public.meta_whatsapp_instances i WHERE i.id = meta_whatsapp_templates.instancia_id AND (i.user_id = (SELECT auth.uid()) OR (SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)))))
WITH CHECK (EXISTS (SELECT 1 FROM public.meta_whatsapp_instances i WHERE i.id = meta_whatsapp_templates.instancia_id AND (i.user_id = (SELECT auth.uid()) OR (SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)))));

DROP POLICY IF EXISTS meta_templates_cliente_parceiro_select ON public.meta_whatsapp_templates;
CREATE POLICY meta_templates_cliente_parceiro_select ON public.meta_whatsapp_templates FOR SELECT
USING (EXISTS (SELECT 1 FROM public.meta_whatsapp_instances i WHERE i.id = meta_whatsapp_templates.instancia_id AND (i.partner_client_id IS NULL OR (SELECT public.is_admin_user((SELECT auth.uid()))) OR public.pode_ver_cliente_parceiro((SELECT auth.uid()), i.partner_client_id))));

DROP POLICY IF EXISTS meta_templates_shared_select ON public.meta_whatsapp_templates;
CREATE POLICY meta_templates_shared_select ON public.meta_whatsapp_templates FOR SELECT
USING ((SELECT public.has_inbox_compartilhado((SELECT auth.uid()))) AND NOT (SELECT public.is_parceiro_meta((SELECT auth.uid()))));

DROP POLICY IF EXISTS tenant_scope_all ON public.meta_whatsapp_templates;
CREATE POLICY tenant_scope_all ON public.meta_whatsapp_templates FOR ALL
USING (public.user_can_access_tenant((SELECT auth.uid()), tenant_id) AND NOT (SELECT public.is_parceiro_meta((SELECT auth.uid()))))
WITH CHECK (public.user_can_access_tenant((SELECT auth.uid()), tenant_id) AND NOT (SELECT public.is_parceiro_meta((SELECT auth.uid()))));