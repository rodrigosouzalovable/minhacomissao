DO $$ BEGIN
  BEGIN
    ALTER TABLE public.envio_meta_job_item REPLICA IDENTITY FULL;
  EXCEPTION WHEN others THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.envio_meta_job_item;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;