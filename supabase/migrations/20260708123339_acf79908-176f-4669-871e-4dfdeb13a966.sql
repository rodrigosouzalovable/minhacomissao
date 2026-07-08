ALTER TABLE public.consulta_cpf_notificacoes ADD COLUMN IF NOT EXISTS cpf_copiado_em timestamptz;

DROP POLICY IF EXISTS "Admins can view all cpf notifs" ON public.consulta_cpf_notificacoes;
CREATE POLICY "Admins can view all cpf notifs"
ON public.consulta_cpf_notificacoes
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update all cpf notifs" ON public.consulta_cpf_notificacoes;
CREATE POLICY "Admins can update all cpf notifs"
ON public.consulta_cpf_notificacoes
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));