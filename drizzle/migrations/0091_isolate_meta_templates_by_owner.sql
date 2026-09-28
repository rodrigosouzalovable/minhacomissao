CREATE POLICY "Templates Meta isolados por proprietario"
ON public.meta_templates_mestre
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (criado_por = auth.uid())
WITH CHECK (criado_por = auth.uid());

CREATE INDEX IF NOT EXISTS idx_meta_templates_mestre_owner_auto
ON public.meta_templates_mestre (criado_por, injetar_em_novos)
WHERE injetar_em_novos = true;