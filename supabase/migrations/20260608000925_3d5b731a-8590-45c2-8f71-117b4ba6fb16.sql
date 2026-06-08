CREATE POLICY "Admins can insert any meta" ON public.metas_funcionarios
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins can update any meta" ON public.metas_funcionarios
  FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin'::app_role));