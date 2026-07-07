DROP POLICY IF EXISTS "Authenticated users can view active meta instances for sending"
  ON public.meta_whatsapp_instances;

CREATE OR REPLACE FUNCTION public.is_active_meta_whatsapp_instance(_instancia_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.meta_whatsapp_instances
    WHERE id = _instancia_id
      AND ativo = true
  );
$$;

REVOKE ALL ON FUNCTION public.is_active_meta_whatsapp_instance(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_active_meta_whatsapp_instance(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_active_meta_whatsapp_instance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_meta_whatsapp_instance(uuid) TO service_role;

CREATE OR REPLACE VIEW public.meta_whatsapp_active_instances_public AS
SELECT
  id,
  nome,
  display_phone,
  ativo,
  saude_status,
  saude_quality,
  saude_name_status,
  saude_ban_info,
  saude_checked_at
FROM public.meta_whatsapp_instances
WHERE ativo = true;

GRANT SELECT ON public.meta_whatsapp_active_instances_public TO authenticated;
GRANT SELECT ON public.meta_whatsapp_active_instances_public TO service_role;

DROP POLICY IF EXISTS "Authenticated users can view approved utility meta templates for sending"
  ON public.meta_whatsapp_templates;

CREATE POLICY "Authenticated users can view approved utility meta templates for sending"
  ON public.meta_whatsapp_templates
  FOR SELECT TO authenticated
  USING (
    status = 'approved'
    AND categoria = 'UTILITY'
    AND public.is_active_meta_whatsapp_instance(instancia_id)
  );