GRANT DELETE ON public.meta_whatsapp_instances TO authenticated;
GRANT ALL ON public.meta_whatsapp_instances TO service_role;
ALTER TABLE public.meta_recuperacao_cadastral_destinos DROP CONSTRAINT IF EXISTS meta_recuperacao_cadastral_destinos_destino_instancia_id_fkey;
ALTER TABLE public.meta_recuperacao_cadastral_destinos ADD CONSTRAINT meta_recuperacao_cadastral_destinos_destino_instancia_id_fkey FOREIGN KEY (destino_instancia_id) REFERENCES public.meta_whatsapp_instances(id) ON DELETE CASCADE;
CREATE OR REPLACE FUNCTION public.can_rename_meta_inbox_folder(_uid uuid, _folder_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.meta_inbox_folder_members m WHERE m.user_id=_uid AND m.folder_id=_folder_id AND m.admin = true)
$$;