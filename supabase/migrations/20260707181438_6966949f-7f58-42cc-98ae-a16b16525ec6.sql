CREATE POLICY "Authenticated users can view active meta instances for sending"
  ON public.meta_whatsapp_instances
  FOR SELECT TO authenticated
  USING (ativo = true);

CREATE POLICY "Authenticated users can view approved utility meta templates for sending"
  ON public.meta_whatsapp_templates
  FOR SELECT TO authenticated
  USING (
    status = 'approved'
    AND categoria = 'UTILITY'
    AND EXISTS (
      SELECT 1
      FROM public.meta_whatsapp_instances i
      WHERE i.id = meta_whatsapp_templates.instancia_id
        AND i.ativo = true
    )
  );