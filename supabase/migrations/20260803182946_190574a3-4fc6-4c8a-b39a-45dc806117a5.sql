CREATE POLICY "Authenticated can read meta profile pics"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'meta-perfis');