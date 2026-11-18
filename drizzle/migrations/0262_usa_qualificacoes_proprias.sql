ALTER TABLE public.meta_qualificacoes ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();
CREATE POLICY "Clientes USA gerenciam as próprias qualificações" ON public.meta_qualificacoes
FOR ALL TO authenticated
USING (public.is_cliente_usa(auth.uid()) AND user_id = auth.uid())
WITH CHECK (public.is_cliente_usa(auth.uid()) AND user_id = auth.uid());
CREATE POLICY "Clientes USA veem apenas as próprias qualificações" ON public.meta_qualificacoes
AS RESTRICTIVE FOR SELECT TO authenticated
USING (NOT public.is_cliente_usa(auth.uid()) OR user_id = auth.uid());