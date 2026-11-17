CREATE OR REPLACE FUNCTION public.meta_cores_atendentes_caixa(_folder uuid)
 RETURNS TABLE(user_id uuid, etiqueta_id uuid, nome text, cor text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT DISTINCT ON (f.user_id) f.user_id, e.id, e.nome, COALESCE(fe.cor, e.cor)
  FROM public.meta_inbox_folder_members m
  JOIN public.meta_atendimento_fila f ON f.user_id = m.user_id
  JOIN public.meta_whatsapp_etiquetas e ON e.id = f.etiqueta_id AND e.nome ILIKE 'Atendente:%'
  LEFT JOIN public.meta_inbox_folder_etiquetas fe ON fe.folder_id = _folder AND fe.etiqueta_id = e.id
  WHERE m.folder_id = _folder AND public.meta_inbox_folder_can_manage(auth.uid(), _folder)
  ORDER BY f.user_id, f.ativo DESC;
$$;
REVOKE ALL ON FUNCTION public.meta_cores_atendentes_caixa(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.meta_cores_atendentes_caixa(uuid) TO authenticated;