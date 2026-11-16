ALTER POLICY meta_templates_parceiro_all ON public.meta_whatsapp_templates
  USING (public.pode_ver_instancia_meta((SELECT auth.uid()), instancia_id))
  WITH CHECK (public.pode_ver_instancia_meta((SELECT auth.uid()), instancia_id));