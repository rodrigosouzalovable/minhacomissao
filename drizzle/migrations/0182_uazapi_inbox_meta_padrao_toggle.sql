ALTER TABLE public.user_whatsapp_instances ADD COLUMN IF NOT EXISTS inbox_meta_ativo boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.definir_uazapi_inbox_meta(p_instancia_id uuid, p_ativo boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_aq uuid;
BEGIN
  IF auth.uid() IS DISTINCT FROM 'ee649720-b8ce-47a2-859e-100a3a9ae6bb'::uuid OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  SELECT id INTO v_aq FROM public.meta_inbox_folders WHERE upper(nome)='AQUECIMENTO' LIMIT 1;
  UPDATE public.user_whatsapp_instances
     SET inbox_meta_ativo = p_ativo,
         iago_desativado = CASE WHEN p_ativo THEN true ELSE iago_desativado END
   WHERE id = p_instancia_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Instância não encontrada'; END IF;
  UPDATE public.meta_whatsapp_instances
     SET folder_padrao_id = CASE WHEN p_ativo THEN NULL ELSE v_aq END,
         folder_padrao_fixo = p_ativo,
         atualizado_em = now()
   WHERE uazapi_instance_id = p_instancia_id AND provider = 'uazapi';
END $$;
REVOKE ALL ON FUNCTION public.definir_uazapi_inbox_meta(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_uazapi_inbox_meta(uuid, boolean) TO authenticated;