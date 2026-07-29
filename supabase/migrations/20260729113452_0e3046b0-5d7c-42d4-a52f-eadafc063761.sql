CREATE POLICY meta_templates_shared_select
ON public.meta_whatsapp_templates
FOR SELECT
TO authenticated
USING (has_inbox_compartilhado(auth.uid()));