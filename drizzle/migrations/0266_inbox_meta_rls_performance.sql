ALTER FUNCTION public.is_admin_user(uuid) STABLE;

ALTER POLICY meta_contatos_folder_member_select ON public.meta_whatsapp_contatos USING (can_view_meta_contato_folder((select auth.uid()), folder_id));
ALTER POLICY meta_contatos_folder_member_update ON public.meta_whatsapp_contatos USING (can_view_meta_contato_folder((select auth.uid()), folder_id)) WITH CHECK (can_view_meta_contato_folder((select auth.uid()), folder_id));
ALTER POLICY meta_contatos_folder_restrict ON public.meta_whatsapp_contatos USING (can_view_meta_contato_folder((select auth.uid()), folder_id)) WITH CHECK (can_view_meta_contato_folder((select auth.uid()), folder_id));
ALTER POLICY meta_contatos_owner_or_admin_all ON public.meta_whatsapp_contatos USING (((select auth.uid()) = user_id) OR (select is_admin_user((select auth.uid())))) WITH CHECK (((select auth.uid()) = user_id) OR (select is_admin_user((select auth.uid()))));
ALTER POLICY meta_contatos_shared_select ON public.meta_whatsapp_contatos USING ((select has_inbox_compartilhado((select auth.uid()))));
ALTER POLICY meta_contatos_shared_update ON public.meta_whatsapp_contatos USING ((select has_inbox_compartilhado((select auth.uid())))) WITH CHECK ((select has_inbox_compartilhado((select auth.uid()))));
ALTER POLICY tenant_scope_all ON public.meta_whatsapp_contatos USING (user_can_access_tenant((select auth.uid()), tenant_id)) WITH CHECK (user_can_access_tenant((select auth.uid()), tenant_id));

ALTER POLICY meta_mensagens_owner_or_admin_all ON public.meta_whatsapp_mensagens USING (((select auth.uid()) = user_id) OR (select is_admin_user((select auth.uid())))) WITH CHECK (((select auth.uid()) = user_id) OR (select is_admin_user((select auth.uid()))));
ALTER POLICY meta_mensagens_shared_select ON public.meta_whatsapp_mensagens USING ((select has_inbox_compartilhado((select auth.uid()))));
ALTER POLICY tenant_scope_all ON public.meta_whatsapp_mensagens USING (user_can_access_tenant((select auth.uid()), tenant_id)) WITH CHECK (user_can_access_tenant((select auth.uid()), tenant_id));

ALTER POLICY meta_contato_etiquetas_shared_select ON public.meta_whatsapp_contato_etiquetas USING ((select has_inbox_compartilhado((select auth.uid()))) AND ((select is_admin_user((select auth.uid()))) OR (EXISTS (SELECT 1 FROM meta_whatsapp_contatos c WHERE c.id = meta_whatsapp_contato_etiquetas.contato_id AND can_view_meta_contato_folder((select auth.uid()), c.folder_id)))));
ALTER POLICY meta_contato_etiquetas_folder_member_select ON public.meta_whatsapp_contato_etiquetas USING (EXISTS (SELECT 1 FROM meta_whatsapp_contatos c WHERE c.id = meta_whatsapp_contato_etiquetas.contato_id AND can_view_meta_contato_folder((select auth.uid()), c.folder_id)));
ALTER POLICY tenant_scope_all ON public.meta_whatsapp_contato_etiquetas USING (user_can_access_tenant((select auth.uid()), tenant_id)) WITH CHECK (user_can_access_tenant((select auth.uid()), tenant_id));