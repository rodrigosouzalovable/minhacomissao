GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_inbox_folders TO authenticated;
GRANT ALL ON public.meta_inbox_folders TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_inbox_folder_members TO authenticated;
GRANT ALL ON public.meta_inbox_folder_members TO service_role;