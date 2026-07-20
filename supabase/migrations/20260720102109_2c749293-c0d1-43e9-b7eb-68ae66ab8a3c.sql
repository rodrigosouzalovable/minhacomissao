
-- 1. inbox-media: scope writes to owner of instance (folder[1] = instancia_id)
DROP POLICY IF EXISTS "Authenticated upload inbox-media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete inbox-media" ON storage.objects;

CREATE POLICY "Owner upload inbox-media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'inbox-media'
  AND (
    public.is_admin_user(auth.uid())
    OR EXISTS (SELECT 1 FROM public.meta_whatsapp_instances i
               WHERE i.id::text = (storage.foldername(name))[1] AND i.user_id = auth.uid())
    OR public.owns_whatsapp_instance((NULLIF((storage.foldername(name))[1], ''))::uuid)
  )
);

CREATE POLICY "Owner update inbox-media"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'inbox-media'
  AND (
    public.is_admin_user(auth.uid())
    OR EXISTS (SELECT 1 FROM public.meta_whatsapp_instances i
               WHERE i.id::text = (storage.foldername(name))[1] AND i.user_id = auth.uid())
    OR public.owns_whatsapp_instance((NULLIF((storage.foldername(name))[1], ''))::uuid)
  )
);

CREATE POLICY "Owner delete inbox-media"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'inbox-media'
  AND (
    public.is_admin_user(auth.uid())
    OR EXISTS (SELECT 1 FROM public.meta_whatsapp_instances i
               WHERE i.id::text = (storage.foldername(name))[1] AND i.user_id = auth.uid())
    OR public.owns_whatsapp_instance((NULLIF((storage.foldername(name))[1], ''))::uuid)
  )
);

-- 2. campaign-audio UPDATE: add folder ownership check
DROP POLICY IF EXISTS "Authenticated users can update campaign-audio" ON storage.objects;
CREATE POLICY "Users can update own campaign-audio"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'campaign-audio'
  AND (storage.foldername(name))[1] = (auth.uid())::text
)
WITH CHECK (
  bucket_id = 'campaign-audio'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

-- 3. devedor-arquivos INSERT: check devedor access
DROP POLICY IF EXISTS "Usuarios autenticados podem fazer upload" ON storage.objects;
CREATE POLICY "Autorizados fazem upload devedor-arquivos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'devedor-arquivos'
  AND auth.uid() IS NOT NULL
  AND (
    public.is_admin_user(auth.uid())
    OR public.has_role(auth.uid(), 'gestor'::app_role)
    OR public.can_view_devedor_id(auth.uid(), (NULLIF((storage.foldername(name))[1], ''))::uuid)
  )
);

-- 4. meta-template-media: restrict writes to admin/gestor (paths are not user-scoped)
DROP POLICY IF EXISTS "Authenticated upload meta-template-media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update meta-template-media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete meta-template-media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated read meta-template-media" ON storage.objects;

CREATE POLICY "Read meta-template-media"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'meta-template-media');

CREATE POLICY "Admins upload meta-template-media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'meta-template-media'
  AND (public.is_admin_user(auth.uid()) OR public.has_role(auth.uid(), 'gestor'::app_role))
);

CREATE POLICY "Admins update meta-template-media"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'meta-template-media'
  AND (public.is_admin_user(auth.uid()) OR public.has_role(auth.uid(), 'gestor'::app_role))
)
WITH CHECK (
  bucket_id = 'meta-template-media'
  AND (public.is_admin_user(auth.uid()) OR public.has_role(auth.uid(), 'gestor'::app_role))
);

CREATE POLICY "Admins delete meta-template-media"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'meta-template-media'
  AND (public.is_admin_user(auth.uid()) OR public.has_role(auth.uid(), 'gestor'::app_role))
);

-- 5. Always-true RLS policies
-- 5a. relatorio_acionamentos_log: constrain insert to own user
DROP POLICY IF EXISTS "ra_log_insert_authenticated" ON public.relatorio_acionamentos_log;
CREATE POLICY "ra_log_insert_own"
ON public.relatorio_acionamentos_log FOR INSERT TO authenticated
WITH CHECK (usuario_id = auth.uid());

-- 5b. whatsapp_perfil_completacao_log: drop redundant policy (service_role bypasses RLS)
DROP POLICY IF EXISTS "Service role gerencia log perfil" ON public.whatsapp_perfil_completacao_log;
