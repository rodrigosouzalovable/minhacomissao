-- 1) Storage: leitura de devedor-arquivos escopada por credor/devedor
DROP POLICY IF EXISTS "Owner or admin can read devedor-arquivos" ON storage.objects;

CREATE POLICY "Owner or admin can read devedor-arquivos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'devedor-arquivos'
  AND (
    owner = auth.uid()
    OR public.is_admin_user(auth.uid())
    OR public.can_view_devedor_id(
         auth.uid(),
         (NULLIF((storage.foldername(name))[1], ''))::uuid
       )
  )
);

-- 2) Etiquetas do Inbox Meta: escopo por caixa de mensagens
DROP POLICY IF EXISTS "meta_contato_etiquetas_shared_select" ON public.meta_whatsapp_contato_etiquetas;
DROP POLICY IF EXISTS "meta_contato_etiquetas_shared_write" ON public.meta_whatsapp_contato_etiquetas;
DROP POLICY IF EXISTS "meta_contato_etiquetas_shared_delete" ON public.meta_whatsapp_contato_etiquetas;

CREATE POLICY "meta_contato_etiquetas_shared_select"
ON public.meta_whatsapp_contato_etiquetas
FOR SELECT
TO authenticated
USING (
  public.has_inbox_compartilhado(auth.uid())
  AND (
    public.is_admin_user(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.meta_whatsapp_contatos c
      WHERE c.id = meta_whatsapp_contato_etiquetas.contato_id
        AND public.can_view_meta_contato_folder(auth.uid(), c.folder_id)
    )
  )
);

CREATE POLICY "meta_contato_etiquetas_shared_write"
ON public.meta_whatsapp_contato_etiquetas
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_inbox_compartilhado(auth.uid())
  AND (
    public.is_admin_user(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.meta_whatsapp_contatos c
      WHERE c.id = meta_whatsapp_contato_etiquetas.contato_id
        AND public.can_view_meta_contato_folder(auth.uid(), c.folder_id)
    )
  )
);

CREATE POLICY "meta_contato_etiquetas_shared_delete"
ON public.meta_whatsapp_contato_etiquetas
FOR DELETE
TO authenticated
USING (
  public.has_inbox_compartilhado(auth.uid())
  AND (origem <> 'auto_atendente' OR public.is_admin_user(auth.uid()))
  AND (
    public.is_admin_user(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.meta_whatsapp_contatos c
      WHERE c.id = meta_whatsapp_contato_etiquetas.contato_id
        AND public.can_view_meta_contato_folder(auth.uid(), c.folder_id)
    )
  )
);