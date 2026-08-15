-- Parceiro Meta: acesso aos templates HSM das instâncias vinculadas
CREATE POLICY "meta_templates_parceiro_all" ON public.meta_whatsapp_templates
  FOR ALL TO authenticated
  USING (public.pode_ver_instancia_meta(auth.uid(), instancia_id))
  WITH CHECK (public.pode_ver_instancia_meta(auth.uid(), instancia_id));

DROP POLICY IF EXISTS "meta_templates_shared_select" ON public.meta_whatsapp_templates;
CREATE POLICY "meta_templates_shared_select" ON public.meta_whatsapp_templates
  FOR SELECT TO authenticated
  USING (public.has_inbox_compartilhado(auth.uid()) AND NOT public.is_parceiro_meta(auth.uid()));

DROP POLICY IF EXISTS "tenant_scope_all" ON public.meta_whatsapp_templates;
CREATE POLICY "tenant_scope_all" ON public.meta_whatsapp_templates
  FOR ALL TO authenticated
  USING (public.user_can_access_tenant(auth.uid(), tenant_id) AND NOT public.is_parceiro_meta(auth.uid()))
  WITH CHECK (public.user_can_access_tenant(auth.uid(), tenant_id) AND NOT public.is_parceiro_meta(auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_whatsapp_templates TO authenticated;
GRANT ALL ON public.meta_whatsapp_templates TO service_role;