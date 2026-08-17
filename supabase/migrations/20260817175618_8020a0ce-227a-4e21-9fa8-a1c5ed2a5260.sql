ALTER TABLE public.meta_inbox_folder_members ADD COLUMN IF NOT EXISTS admin boolean NOT NULL DEFAULT false;
ALTER TABLE public.meta_inbox_default_members ADD COLUMN IF NOT EXISTS admin boolean NOT NULL DEFAULT false;

UPDATE public.meta_inbox_folder_members m
SET admin = true
FROM public.meta_inbox_folders f
WHERE f.id = m.folder_id AND f.owner_id = m.user_id AND m.admin = false;

CREATE OR REPLACE FUNCTION public.meta_inbox_folder_can_manage(_uid uuid, _folder uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _uid IS NOT NULL AND (
    public.has_role(_uid, 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.meta_inbox_folders f
      WHERE f.id = _folder AND f.owner_id = _uid
    )
    OR EXISTS (
      SELECT 1 FROM public.meta_inbox_folder_members m
      WHERE m.folder_id = _folder AND m.user_id = _uid AND m.admin = true
    )
  )
$$;

CREATE OR REPLACE FUNCTION public.meta_inbox_default_can_manage(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _uid IS NOT NULL AND (
    public.has_role(_uid, 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.meta_inbox_default_members d
      WHERE d.user_id = _uid AND d.admin = true
    )
  )
$$;

REVOKE EXECUTE ON FUNCTION public.meta_inbox_default_can_manage(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.meta_inbox_default_can_manage(uuid) TO authenticated;

DROP POLICY IF EXISTS "folder members admin folder select" ON public.meta_inbox_folder_members;
CREATE POLICY "folder members admin folder select"
ON public.meta_inbox_folder_members FOR SELECT TO authenticated
USING (public.meta_inbox_folder_can_manage(auth.uid(), folder_id));

DROP POLICY IF EXISTS "default members box admin manage" ON public.meta_inbox_default_members;
CREATE POLICY "default members box admin manage"
ON public.meta_inbox_default_members FOR ALL TO authenticated
USING (public.meta_inbox_default_can_manage(auth.uid()))
WITH CHECK (public.meta_inbox_default_can_manage(auth.uid()));