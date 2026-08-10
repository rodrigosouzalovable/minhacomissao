-- 1) Escopo por caixa/pasta do contato em meta_contato_qualificacao
DROP POLICY IF EXISTS cq_select_auth ON public.meta_contato_qualificacao;
DROP POLICY IF EXISTS cq_insert_auth ON public.meta_contato_qualificacao;
DROP POLICY IF EXISTS cq_update_auth ON public.meta_contato_qualificacao;
DROP POLICY IF EXISTS cq_delete_auth ON public.meta_contato_qualificacao;

CREATE POLICY cq_select_folder ON public.meta_contato_qualificacao
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.meta_whatsapp_contatos c
    WHERE c.id = meta_contato_qualificacao.contato_id
      AND public.can_view_meta_contato_folder(auth.uid(), c.folder_id)
  )
);

CREATE POLICY cq_insert_folder ON public.meta_contato_qualificacao
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.meta_whatsapp_contatos c
    WHERE c.id = meta_contato_qualificacao.contato_id
      AND public.can_view_meta_contato_folder(auth.uid(), c.folder_id)
  )
);

CREATE POLICY cq_update_folder ON public.meta_contato_qualificacao
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.meta_whatsapp_contatos c
    WHERE c.id = meta_contato_qualificacao.contato_id
      AND public.can_view_meta_contato_folder(auth.uid(), c.folder_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.meta_whatsapp_contatos c
    WHERE c.id = meta_contato_qualificacao.contato_id
      AND public.can_view_meta_contato_folder(auth.uid(), c.folder_id)
  )
);

CREATE POLICY cq_delete_folder ON public.meta_contato_qualificacao
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.meta_whatsapp_contatos c
    WHERE c.id = meta_contato_qualificacao.contato_id
      AND public.can_view_meta_contato_folder(auth.uid(), c.folder_id)
  )
);

-- 2) Moderação de áudios de campanha por admin
DROP POLICY IF EXISTS "Admins can delete campaign-audio" ON storage.objects;
CREATE POLICY "Admins can delete campaign-audio" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'campaign-audio' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update campaign-audio" ON storage.objects;
CREATE POLICY "Admins can update campaign-audio" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'campaign-audio' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'campaign-audio' AND public.has_role(auth.uid(), 'admin'));