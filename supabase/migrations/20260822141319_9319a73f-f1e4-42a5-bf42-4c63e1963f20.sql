DROP FUNCTION IF EXISTS public.get_meta_whatsapp_active_instances_for_sending();
CREATE OR REPLACE FUNCTION public.get_meta_whatsapp_active_instances_for_sending()
RETURNS TABLE(id uuid, nome text, display_phone text, ativo boolean, saude_status text, saude_quality text, saude_name_status text, saude_ban_info jsonb, saude_checked_at timestamp with time zone, provider text, estado_pool text, pausa_automatica_ate timestamp with time zone, pausa_automatica_motivo text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT i.id, i.nome, i.display_phone, i.ativo, i.saude_status, i.saude_quality,
         i.saude_name_status, i.saude_ban_info, i.saude_checked_at, i.provider,
         i.estado_pool, i.pausa_automatica_ate, i.pausa_automatica_motivo
  FROM public.meta_whatsapp_instances i
  WHERE i.ativo = true
    AND public.pode_ver_instancia_meta(auth.uid(), i.id)
  ORDER BY i.nome;
$function$;