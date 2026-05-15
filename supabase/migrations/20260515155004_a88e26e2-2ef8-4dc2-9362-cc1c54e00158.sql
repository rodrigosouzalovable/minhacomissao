CREATE POLICY "Authenticated users can view all acordos"
ON public.acordos FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can view all pagamentos"
ON public.pagamentos FOR SELECT
TO authenticated
USING (true);