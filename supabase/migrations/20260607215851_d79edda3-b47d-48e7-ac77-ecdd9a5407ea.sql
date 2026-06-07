DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Admins podem enviar planilhas de estrategias'
  ) THEN
    CREATE POLICY "Admins podem enviar planilhas de estrategias"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'estrategia-uploads'
        AND public.is_admin_user(auth.uid())
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Admins podem sobrescrever planilhas de estrategias'
  ) THEN
    CREATE POLICY "Admins podem sobrescrever planilhas de estrategias"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'estrategia-uploads'
        AND public.is_admin_user(auth.uid())
        AND (storage.foldername(name))[1] = auth.uid()::text
      )
      WITH CHECK (
        bucket_id = 'estrategia-uploads'
        AND public.is_admin_user(auth.uid())
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;