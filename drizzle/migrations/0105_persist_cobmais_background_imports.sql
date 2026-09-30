ALTER TABLE public.cobmais_importacoes_diarias
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS fase text NOT NULL DEFAULT 'validando',
  ADD COLUMN IF NOT EXISTS progresso smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ultima_atividade_em timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.cobmais_importacoes_diarias
  ADD CONSTRAINT cobmais_importacoes_progresso_valido
  CHECK (progresso BETWEEN 0 AND 100) NOT VALID;

CREATE INDEX IF NOT EXISTS idx_cobmais_importacoes_usuario_recente
  ON public.cobmais_importacoes_diarias (importado_por, iniciado_em DESC);

CREATE POLICY "Admins enviam planilhas Cobmais privadas"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'cobmais-importacoes'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Admins leem planilhas Cobmais privadas"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'cobmais-importacoes'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Admins removem planilhas Cobmais privadas"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'cobmais-importacoes'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
    AND (storage.foldername(name))[1] = auth.uid()::text
  );