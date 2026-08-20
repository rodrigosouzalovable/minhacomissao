DROP POLICY IF EXISTS "Auth upload inbox-media" ON storage.objects;
CREATE POLICY "Auth upload inbox-media" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'inbox-media'
  AND (
    is_admin_user(auth.uid())
    OR (storage.foldername(name))[1] = ANY (ARRAY['meta-templates','quick-replies','meta'])
    OR EXISTS (SELECT 1 FROM meta_whatsapp_instances mi WHERE mi.id::text = (storage.foldername(name))[1])
    OR EXISTS (SELECT 1 FROM user_whatsapp_instances ui WHERE ui.id::text = (storage.foldername(name))[1] AND ui.user_id = auth.uid())
  )
);