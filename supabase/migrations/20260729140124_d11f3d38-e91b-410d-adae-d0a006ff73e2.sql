CREATE POLICY "folders owner insert own"
ON public.meta_inbox_folders
FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "folders owner update own"
ON public.meta_inbox_folders
FOR UPDATE
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "folders owner delete own"
ON public.meta_inbox_folders
FOR DELETE
TO authenticated
USING (owner_id = auth.uid());