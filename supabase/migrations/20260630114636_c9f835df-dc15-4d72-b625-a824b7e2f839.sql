
DROP POLICY IF EXISTS "Marcar pago global pode ver acordos" ON public.acordos;
CREATE POLICY "Marcar pago global pode ver acordos"
ON public.acordos FOR SELECT TO authenticated
USING (public.pode_marcar_pago_global(auth.uid()));
