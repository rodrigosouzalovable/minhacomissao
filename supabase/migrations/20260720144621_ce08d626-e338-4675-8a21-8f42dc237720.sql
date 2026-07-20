
DROP POLICY IF EXISTS "Owner upload inbox-media" ON storage.objects;
DROP POLICY IF EXISTS "Owner update inbox-media" ON storage.objects;
DROP POLICY IF EXISTS "Owner delete inbox-media" ON storage.objects;

CREATE POLICY "Auth upload inbox-media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'inbox-media'
  AND (
    is_admin_user(auth.uid())
    OR EXISTS (SELECT 1 FROM public.meta_whatsapp_instances i WHERE i.id::text = (storage.foldername(name))[1])
    OR EXISTS (SELECT 1 FROM public.user_whatsapp_instances u WHERE u.id::text = (storage.foldername(name))[1])
  )
);

CREATE POLICY "Auth update inbox-media"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'inbox-media'
  AND (
    is_admin_user(auth.uid())
    OR EXISTS (SELECT 1 FROM public.meta_whatsapp_instances i WHERE i.id::text = (storage.foldername(name))[1] AND i.user_id = auth.uid())
    OR owns_whatsapp_instance((NULLIF((storage.foldername(name))[1], '')::uuid))
  )
);

CREATE POLICY "Auth delete inbox-media"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'inbox-media'
  AND (
    is_admin_user(auth.uid())
    OR EXISTS (SELECT 1 FROM public.meta_whatsapp_instances i WHERE i.id::text = (storage.foldername(name))[1] AND i.user_id = auth.uid())
    OR owns_whatsapp_instance((NULLIF((storage.foldername(name))[1], '')::uuid))
  )
);
