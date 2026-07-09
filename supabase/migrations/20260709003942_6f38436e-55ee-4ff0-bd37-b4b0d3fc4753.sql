GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_templates_mestre TO authenticated;
GRANT ALL ON public.meta_templates_mestre TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_templates_instancia TO authenticated;
GRANT ALL ON public.meta_templates_instancia TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_templates_lote_log TO authenticated;
GRANT ALL ON public.meta_templates_lote_log TO service_role;