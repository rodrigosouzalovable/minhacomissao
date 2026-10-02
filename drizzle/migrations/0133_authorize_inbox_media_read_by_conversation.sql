-- Reading/signed URL access must follow the same conversation permission as upload.
-- Compare instance IDs as text so legacy paths with a phone as first segment never cast to UUID.
DROP POLICY IF EXISTS "Auth read inbox-media" ON storage.objects;
CREATE POLICY "Auth read inbox-media"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'inbox-media'
  AND (
    public.is_admin_user(auth.uid())
    OR (storage.foldername(name))[1] = ANY (ARRAY['meta-templates', 'quick-replies', 'meta'])
    OR EXISTS (
      SELECT 1 FROM public.meta_whatsapp_instances mi
      WHERE mi.id::text = (storage.foldername(objects.name))[1]
        AND mi.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_whatsapp_instances ui
      WHERE ui.id::text = (storage.foldername(objects.name))[1]
        AND ui.user_id = auth.uid()
    )
    OR public.can_upload_inbox_media_for_conversation(auth.uid(), name)
  )
);