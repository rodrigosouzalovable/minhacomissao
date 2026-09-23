DROP POLICY IF EXISTS "Admins upload meta-template-media" ON storage.objects;
CREATE POLICY "Authorized upload meta-template-media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'meta-template-media'
  AND (
    public.is_admin_user(auth.uid())
    OR public.has_role(auth.uid(), 'gestor'::public.app_role)
    OR (
      public.is_parceiro_meta(auth.uid())
      AND (storage.foldername(name))[1] = auth.uid()::text
    )
  )
);

DROP POLICY IF EXISTS "Admins read meta-template-media" ON storage.objects;
CREATE POLICY "Authorized read meta-template-media"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'meta-template-media'
  AND (
    public.is_admin_user(auth.uid())
    OR public.has_role(auth.uid(), 'gestor'::public.app_role)
    OR (
      public.is_parceiro_meta(auth.uid())
      AND (storage.foldername(name))[1] = auth.uid()::text
    )
  )
);

DROP POLICY IF EXISTS "Admins update meta-template-media" ON storage.objects;
CREATE POLICY "Authorized update meta-template-media"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'meta-template-media'
  AND (
    public.is_admin_user(auth.uid())
    OR public.has_role(auth.uid(), 'gestor'::public.app_role)
    OR (
      public.is_parceiro_meta(auth.uid())
      AND (storage.foldername(name))[1] = auth.uid()::text
    )
  )
)
WITH CHECK (
  bucket_id = 'meta-template-media'
  AND (
    public.is_admin_user(auth.uid())
    OR public.has_role(auth.uid(), 'gestor'::public.app_role)
    OR (
      public.is_parceiro_meta(auth.uid())
      AND (storage.foldername(name))[1] = auth.uid()::text
    )
  )
);

DROP POLICY IF EXISTS "Admins delete meta-template-media" ON storage.objects;
CREATE POLICY "Authorized delete meta-template-media"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'meta-template-media'
  AND (
    public.is_admin_user(auth.uid())
    OR public.has_role(auth.uid(), 'gestor'::public.app_role)
    OR (
      public.is_parceiro_meta(auth.uid())
      AND (storage.foldername(name))[1] = auth.uid()::text
    )
  )
);