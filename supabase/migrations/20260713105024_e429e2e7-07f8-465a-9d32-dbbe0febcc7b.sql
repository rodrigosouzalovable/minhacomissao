
CREATE POLICY "consultoria aluno lê material"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'consultoria-materiais' AND (public.is_consultoria_aluno(auth.uid()) OR public.is_consultoria_admin(auth.uid())));

CREATE POLICY "consultoria admin escreve material"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'consultoria-materiais' AND public.is_consultoria_admin(auth.uid()));

CREATE POLICY "consultoria admin atualiza material"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'consultoria-materiais' AND public.is_consultoria_admin(auth.uid()));

CREATE POLICY "consultoria admin remove material"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'consultoria-materiais' AND public.is_consultoria_admin(auth.uid()));
