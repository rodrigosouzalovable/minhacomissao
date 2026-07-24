
DROP POLICY IF EXISTS "Auth upload inbox-media" ON storage.objects;
DROP POLICY IF EXISTS "Auth update inbox-media" ON storage.objects;
DROP POLICY IF EXISTS "Auth delete inbox-media" ON storage.objects;

CREATE POLICY "Auth upload inbox-media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'inbox-media' AND (
    public.is_admin_user(auth.uid())
    OR (storage.foldername(name))[1] IN ('meta-templates','quick-replies','meta')
    OR EXISTS (
      SELECT 1 FROM public.meta_whatsapp_instances mi
      WHERE mi.id::text = (storage.foldername(name))[1]
    )
    OR EXISTS (
      SELECT 1 FROM public.user_whatsapp_instances ui
      WHERE ui.id::text = (storage.foldername(name))[1]
        AND ui.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Auth update inbox-media"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'inbox-media' AND (
    public.is_admin_user(auth.uid())
    OR (storage.foldername(name))[1] IN ('meta-templates','quick-replies','meta')
    OR EXISTS (
      SELECT 1 FROM public.meta_whatsapp_instances mi
      WHERE mi.id::text = (storage.foldername(name))[1]
    )
    OR public.owns_whatsapp_instance(NULLIF((storage.foldername(name))[1], '')::uuid)
  )
);

CREATE POLICY "Auth delete inbox-media"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'inbox-media' AND (
    public.is_admin_user(auth.uid())
    OR (storage.foldername(name))[1] IN ('meta-templates','quick-replies','meta')
    OR EXISTS (
      SELECT 1 FROM public.meta_whatsapp_instances mi
      WHERE mi.id::text = (storage.foldername(name))[1]
    )
    OR public.owns_whatsapp_instance(NULLIF((storage.foldername(name))[1], '')::uuid)
  )
);
