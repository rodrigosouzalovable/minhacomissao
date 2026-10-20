CREATE OR REPLACE FUNCTION public.can_rename_meta_inbox_folder(_uid uuid, _folder_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_permissions p WHERE p.user_id=_uid AND p.parceiro_meta = true)
     AND EXISTS (SELECT 1 FROM public.meta_inbox_folder_members m WHERE m.user_id=_uid AND m.folder_id=_folder_id AND m.admin = true)
$$;

CREATE POLICY "folders partner admin rename" ON public.meta_inbox_folders FOR UPDATE TO authenticated
USING (public.can_rename_meta_inbox_folder(auth.uid(), id))
WITH CHECK (public.can_rename_meta_inbox_folder(auth.uid(), id));

CREATE OR REPLACE FUNCTION public.meta_inbox_folder_guard_rename()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR OLD.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin') THEN RETURN NEW; END IF;
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id OR NEW.cor IS DISTINCT FROM OLD.cor THEN
    RAISE EXCEPTION 'Admin da caixa só pode alterar o nome';
  END IF;
  IF length(trim(coalesce(NEW.nome,''))) = 0 OR length(NEW.nome) > 60 THEN
    RAISE EXCEPTION 'Nome inválido';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_meta_inbox_folder_guard_rename BEFORE UPDATE ON public.meta_inbox_folders
FOR EACH ROW EXECUTE FUNCTION public.meta_inbox_folder_guard_rename();