
-- devedor_eventos: adicionar can_view_devedor_id nas policies de INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "Usuarios autenticados podem criar eventos" ON public.devedor_eventos;
CREATE POLICY "Usuarios autenticados podem criar eventos"
  ON public.devedor_eventos FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = criado_por AND public.can_view_devedor_id(auth.uid(), devedor_id));

DROP POLICY IF EXISTS "Usuarios autenticados podem atualizar eventos" ON public.devedor_eventos;
CREATE POLICY "Usuarios autenticados podem atualizar eventos"
  ON public.devedor_eventos FOR UPDATE TO authenticated
  USING (auth.uid() = criado_por AND public.can_view_devedor_id(auth.uid(), devedor_id))
  WITH CHECK (auth.uid() = criado_por AND public.can_view_devedor_id(auth.uid(), devedor_id));

DROP POLICY IF EXISTS "Usuarios autenticados podem excluir eventos" ON public.devedor_eventos;
CREATE POLICY "Usuarios autenticados podem excluir eventos"
  ON public.devedor_eventos FOR DELETE TO authenticated
  USING (auth.uid() = criado_por AND public.can_view_devedor_id(auth.uid(), devedor_id));

-- parcelas_devedor: exigir autorização via acordos_devedor / can_view_devedor_cpf
DROP POLICY IF EXISTS "Usuarios autenticados podem criar parcelas_devedor" ON public.parcelas_devedor;
CREATE POLICY "Usuarios autenticados podem criar parcelas_devedor"
  ON public.parcelas_devedor FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.acordos_devedor ad
    WHERE ad.id = parcelas_devedor.acordo_id
      AND public.can_view_devedor_cpf(auth.uid(), ad.devedor_cpf)
  ));

DROP POLICY IF EXISTS "Usuarios autenticados podem atualizar parcelas_devedor" ON public.parcelas_devedor;
CREATE POLICY "Usuarios autenticados podem atualizar parcelas_devedor"
  ON public.parcelas_devedor FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.acordos_devedor ad
    WHERE ad.id = parcelas_devedor.acordo_id
      AND public.can_view_devedor_cpf(auth.uid(), ad.devedor_cpf)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.acordos_devedor ad
    WHERE ad.id = parcelas_devedor.acordo_id
      AND public.can_view_devedor_cpf(auth.uid(), ad.devedor_cpf)
  ));
