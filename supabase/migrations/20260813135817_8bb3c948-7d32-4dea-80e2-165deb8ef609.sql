-- 1. credor_desconto_faixas: restrict read
DROP POLICY IF EXISTS "Faixas de desconto legiveis por autenticados" ON public.credor_desconto_faixas;
CREATE POLICY "Faixas de desconto visiveis por credor autorizado"
ON public.credor_desconto_faixas FOR SELECT TO authenticated
USING (public.is_admin_user(auth.uid()) OR public.can_view_credor(auth.uid(), credor));

-- 2. whatsapp_aquecimento_grupo_config: admin only
DROP POLICY IF EXISTS "Auth pode ler config conversa grupo" ON public.whatsapp_aquecimento_grupo_config;
CREATE POLICY "Admins leem config conversa grupo"
ON public.whatsapp_aquecimento_grupo_config FOR SELECT TO authenticated
USING (public.is_admin_user(auth.uid()));

-- 3. storage inbox-media: scope read access
DROP POLICY IF EXISTS "Auth read inbox-media" ON storage.objects;
CREATE POLICY "Auth read inbox-media"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'inbox-media'
  AND (
    public.is_admin_user(auth.uid())
    OR (storage.foldername(name))[1] = ANY (ARRAY['meta-templates','quick-replies','meta'])
    OR EXISTS (
      SELECT 1 FROM public.meta_whatsapp_instances mi
      WHERE mi.id::text = (storage.foldername(objects.name))[1]
        AND (
          mi.user_id = auth.uid()
          OR public.has_any_meta_folder_access(auth.uid())
          OR public.has_inbox_compartilhado(auth.uid())
        )
    )
    OR public.owns_whatsapp_instance(NULLIF((storage.foldername(name))[1], '')::uuid)
  )
);