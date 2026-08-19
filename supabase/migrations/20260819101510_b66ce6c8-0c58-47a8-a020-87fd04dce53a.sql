ALTER TABLE public.virtualsms_pedidos REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.virtualsms_pedidos;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;