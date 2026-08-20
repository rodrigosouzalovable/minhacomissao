ALTER TABLE public.meta_call_permissions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meta_call_permissions;