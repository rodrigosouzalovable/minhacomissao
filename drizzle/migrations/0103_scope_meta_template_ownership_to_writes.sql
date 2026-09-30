DROP POLICY IF EXISTS "Templates Meta isolados por proprietario" ON public.meta_templates_mestre;

CREATE POLICY "Templates Meta inseridos pelo proprietario"
ON public.meta_templates_mestre
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (criado_por = auth.uid() OR public.is_admin_user(auth.uid()));

CREATE POLICY "Templates Meta alterados pelo proprietario ou admin"
ON public.meta_templates_mestre
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (criado_por = auth.uid() OR public.is_admin_user(auth.uid()))
WITH CHECK (criado_por = auth.uid() OR public.is_admin_user(auth.uid()));

CREATE POLICY "Templates Meta excluidos pelo proprietario ou admin"
ON public.meta_templates_mestre
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (criado_por = auth.uid() OR public.is_admin_user(auth.uid()));

COMMENT ON TABLE public.meta_templates_mestre IS 'Leitura segue o escopo de acesso existente; criação e automação permanecem isoladas por proprietário, com administração global autorizada.';