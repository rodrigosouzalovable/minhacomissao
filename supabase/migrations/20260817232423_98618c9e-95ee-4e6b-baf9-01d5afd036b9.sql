CREATE OR REPLACE FUNCTION public.is_instancia_parceiro(_instancia uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.meta_instance_parceiros p WHERE p.instancia_id = _instancia)
$$;

CREATE OR REPLACE FUNCTION public.pode_ver_instancia_meta(_uid uuid, _instancia uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _uid IS NULL THEN false
    WHEN public.is_parceiro_meta(_uid) THEN public.parceiro_tem_instancia(_uid, _instancia)
    WHEN public.is_instancia_parceiro(_instancia) THEN false
    WHEN public.is_admin_user(_uid) THEN true
    ELSE EXISTS (
      SELECT 1 FROM public.meta_whatsapp_instances i
      WHERE i.id = _instancia
        AND (
          i.user_id = _uid
          OR public.has_any_meta_folder_access(_uid)
          OR public.has_inbox_compartilhado(_uid)
          OR public.user_can_access_tenant(_uid, i.tenant_id)
        )
    )
  END
$$;

DROP FUNCTION IF EXISTS public.get_meta_whatsapp_active_instances_for_sending();
CREATE OR REPLACE FUNCTION public.get_meta_whatsapp_active_instances_for_sending()
RETURNS TABLE(id uuid, nome text, display_phone text, ativo boolean, saude_status text, saude_quality text, saude_name_status text, saude_ban_info jsonb, saude_checked_at timestamp with time zone, provider text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.id, i.nome, i.display_phone, i.ativo, i.saude_status, i.saude_quality,
         i.saude_name_status, i.saude_ban_info, i.saude_checked_at, i.provider
  FROM public.meta_whatsapp_instances i
  WHERE i.ativo = true
    AND public.pode_ver_instancia_meta(auth.uid(), i.id)
  ORDER BY i.nome;
$$;