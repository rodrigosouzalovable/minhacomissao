
CREATE POLICY "Authenticated read meta-template-media"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'meta-template-media');

CREATE POLICY "Authenticated upload meta-template-media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'meta-template-media');

CREATE POLICY "Authenticated update meta-template-media"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'meta-template-media');

CREATE POLICY "Authenticated delete meta-template-media"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'meta-template-media');
