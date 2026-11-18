CREATE OR REPLACE FUNCTION public.is_cliente_usa(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.cliente_usa_config c WHERE c.user_id = _uid AND c.usa_b2b = true) $$;

CREATE OR REPLACE FUNCTION public.meta_etiquetas_da_caixa(_folder uuid)
 RETURNS TABLE(id uuid, nome text, cor text, ativa boolean)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT e.id, COALESCE(local.nome, e.nome), COALESCE(local.cor, e.cor), COALESCE(local.ativa, e.ativa)
  FROM public.meta_whatsapp_etiquetas e
  LEFT JOIN public.meta_inbox_folder_etiquetas local ON local.etiqueta_id = e.id AND local.folder_id = _folder
  WHERE auth.uid() IS NOT NULL
    AND (_folder IS NULL OR public.can_access_meta_folder(auth.uid(), _folder))
    AND (NOT public.is_cliente_usa(auth.uid()) OR e.user_id = auth.uid())
    AND NOT EXISTS (SELECT 1 FROM public.meta_inbox_folder_etiquetas exclusiva
      WHERE exclusiva.etiqueta_id = e.id AND exclusiva.exclusiva = true
        AND (_folder IS NULL OR exclusiva.folder_id <> _folder))
  ORDER BY 2;
$function$;

DROP POLICY IF EXISTS "Clientes USA veem apenas as próprias etiquetas" ON public.meta_whatsapp_etiquetas;
CREATE POLICY "Clientes USA veem apenas as próprias etiquetas" ON public.meta_whatsapp_etiquetas
AS RESTRICTIVE FOR SELECT TO authenticated
USING (NOT public.is_cliente_usa(auth.uid()) OR user_id = auth.uid());