DROP VIEW IF EXISTS public.meta_whatsapp_active_instances_public;

CREATE OR REPLACE FUNCTION public.get_meta_whatsapp_active_instances_for_sending()
RETURNS TABLE (
  id uuid,
  nome text,
  display_phone text,
  ativo boolean,
  saude_status text,
  saude_quality text,
  saude_name_status text,
  saude_ban_info jsonb,
  saude_checked_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.id,
    i.nome,
    i.display_phone,
    i.ativo,
    i.saude_status,
    i.saude_quality,
    i.saude_name_status,
    i.saude_ban_info,
    i.saude_checked_at
  FROM public.meta_whatsapp_instances i
  WHERE i.ativo = true
  ORDER BY i.nome;
$$;

REVOKE ALL ON FUNCTION public.get_meta_whatsapp_active_instances_for_sending() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_meta_whatsapp_active_instances_for_sending() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_meta_whatsapp_active_instances_for_sending() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_meta_whatsapp_active_instances_for_sending() TO service_role;