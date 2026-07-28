
-- 1) Fix mutable search_path on phone_suffix8
CREATE OR REPLACE FUNCTION public.phone_suffix8(tel text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $function$
  SELECT CASE
    WHEN tel IS NULL THEN NULL
    WHEN LENGTH(REGEXP_REPLACE(tel, '\D', '', 'g')) >= 8
      THEN RIGHT(REGEXP_REPLACE(tel, '\D', '', 'g'), 8)
    ELSE NULL
  END;
$function$;

-- 2) campaign-audio: enforce folder ownership on INSERT
DROP POLICY IF EXISTS "Authenticated users can upload to campaign-audio" ON storage.objects;
CREATE POLICY "Authenticated users can upload to campaign-audio"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'campaign-audio'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 3) inbox-media: remove shared-folder bypass for non-admins on INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "Auth upload inbox-media" ON storage.objects;
CREATE POLICY "Auth upload inbox-media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'inbox-media'
  AND (
    public.is_admin_user(auth.uid())
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

DROP POLICY IF EXISTS "Auth update inbox-media" ON storage.objects;
CREATE POLICY "Auth update inbox-media"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'inbox-media'
  AND (
    public.is_admin_user(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.meta_whatsapp_instances mi
      WHERE mi.id::text = (storage.foldername(objects.name))[1]
    )
    OR public.owns_whatsapp_instance(NULLIF((storage.foldername(name))[1], '')::uuid)
  )
);

DROP POLICY IF EXISTS "Auth delete inbox-media" ON storage.objects;
CREATE POLICY "Auth delete inbox-media"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'inbox-media'
  AND (
    public.is_admin_user(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.meta_whatsapp_instances mi
      WHERE mi.id::text = (storage.foldername(objects.name))[1]
    )
    OR public.owns_whatsapp_instance(NULLIF((storage.foldername(name))[1], '')::uuid)
  )
);
