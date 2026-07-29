CREATE OR REPLACE FUNCTION public.meta_inbox_folder_can_manage(_uid uuid, _folder uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _uid IS NOT NULL AND (
    public.has_role(_uid, 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.meta_inbox_folders f
      WHERE f.id = _folder
        AND f.owner_id = _uid
    )
  )
$$;

CREATE OR REPLACE FUNCTION public.meta_inbox_folder_can_view(_uid uuid, _folder uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _uid IS NOT NULL AND (
    public.has_role(_uid, 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.meta_inbox_folders f
      WHERE f.id = _folder
        AND f.owner_id = _uid
    )
    OR EXISTS (
      SELECT 1
      FROM public.meta_inbox_folder_members m
      WHERE m.folder_id = _folder
        AND m.user_id = _uid
    )
  )
$$;

DROP POLICY IF EXISTS "folders member select" ON public.meta_inbox_folders;
DROP POLICY IF EXISTS "folder members owner manage" ON public.meta_inbox_folder_members;

CREATE POLICY "folders member select"
ON public.meta_inbox_folders
FOR SELECT
TO authenticated
USING (public.meta_inbox_folder_can_view(auth.uid(), id));

CREATE POLICY "folder members owner manage"
ON public.meta_inbox_folder_members
FOR ALL
TO authenticated
USING (public.meta_inbox_folder_can_manage(auth.uid(), folder_id))
WITH CHECK (public.meta_inbox_folder_can_manage(auth.uid(), folder_id));