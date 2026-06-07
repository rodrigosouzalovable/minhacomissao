CREATE OR REPLACE FUNCTION public.has_estrategias_access(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT uid IS NOT NULL AND (
    public.is_admin_user(uid)
    OR EXISTS (
      SELECT 1
      FROM public.user_permissions up
      WHERE up.user_id = uid
        AND 'estrategias' = ANY(COALESCE(up.abas_permitidas, ARRAY[]::text[]))
    )
  )
$$;

DROP POLICY IF EXISTS "Admins podem enviar planilhas de estrategias" ON storage.objects;
DROP POLICY IF EXISTS "Admins podem sobrescrever planilhas de estrategias" ON storage.objects;

CREATE POLICY "Usuarios com estrategias podem enviar planilhas"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'estrategia-uploads'
  AND public.has_estrategias_access(auth.uid())
);

CREATE POLICY "Usuarios com estrategias podem sobrescrever planilhas"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'estrategia-uploads'
  AND public.has_estrategias_access(auth.uid())
)
WITH CHECK (
  bucket_id = 'estrategia-uploads'
  AND public.has_estrategias_access(auth.uid())
);