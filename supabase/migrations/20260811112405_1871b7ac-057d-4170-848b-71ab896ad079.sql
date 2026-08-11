DROP POLICY IF EXISTS "Public read inbox-media" ON storage.objects;

CREATE POLICY "Auth read inbox-media"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'inbox-media');
