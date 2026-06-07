DROP POLICY IF EXISTS "Admins podem enviar planilhas de estrategias" ON storage.objects;
DROP POLICY IF EXISTS "Admins podem sobrescrever planilhas de estrategias" ON storage.objects;

CREATE POLICY "Admins podem enviar planilhas de estrategias"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'estrategia-uploads'
    AND public.is_admin_user(auth.uid())
  );

CREATE POLICY "Admins podem sobrescrever planilhas de estrategias"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'estrategia-uploads'
    AND public.is_admin_user(auth.uid())
  )
  WITH CHECK (
    bucket_id = 'estrategia-uploads'
    AND public.is_admin_user(auth.uid())
  );