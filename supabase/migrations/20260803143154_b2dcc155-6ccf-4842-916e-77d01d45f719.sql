-- Garantir escopo admin-only consistente na tabela de imagens de status
REVOKE ALL ON public.whatsapp_aquecimento_status_imagens FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_aquecimento_status_imagens TO authenticated;
GRANT ALL ON public.whatsapp_aquecimento_status_imagens TO service_role;

ALTER TABLE public.whatsapp_aquecimento_status_imagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_aquecimento_status_imagens FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read status images" ON public.whatsapp_aquecimento_status_imagens;
DROP POLICY IF EXISTS "Admins manage status images" ON public.whatsapp_aquecimento_status_imagens;

CREATE POLICY "Admins manage status images"
ON public.whatsapp_aquecimento_status_imagens
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));