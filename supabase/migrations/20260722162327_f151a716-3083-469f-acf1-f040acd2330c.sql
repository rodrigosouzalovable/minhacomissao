
-- Fix 1: whatsapp_aquecimento_status_imagens - restrict SELECT to admins
DROP POLICY IF EXISTS "All authenticated read status images" ON public.whatsapp_aquecimento_status_imagens;
CREATE POLICY "Admins read status images"
ON public.whatsapp_aquecimento_status_imagens
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Fix 2: inbox-media upload policy - scope to instance owner
DROP POLICY IF EXISTS "Auth upload inbox-media" ON storage.objects;
CREATE POLICY "Auth upload inbox-media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'inbox-media'
  AND (
    EXISTS (
      SELECT 1 FROM public.user_whatsapp_instances i
      WHERE i.id::text = (storage.foldername(name))[1]
        AND i.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.meta_whatsapp_instances mi
      WHERE mi.id::text = (storage.foldername(name))[1]
        AND mi.user_id = auth.uid()
    )
    OR (storage.foldername(name))[1] = 'meta-templates'
    OR (storage.foldername(name))[1] = 'quick-replies'
  )
);

-- Fix 3: metas_mensais - restrict SELECT to admins
DROP POLICY IF EXISTS "Usuários autenticados podem ver metas" ON public.metas_mensais;
CREATE POLICY "Admins podem ver metas mensais"
ON public.metas_mensais
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
