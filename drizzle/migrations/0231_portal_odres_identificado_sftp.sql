CREATE INDEX IF NOT EXISTS idx_ume_carteira_parcelas_cpf_carteira ON public.ume_carteira_parcelas (cpf, carteira);
CREATE OR REPLACE FUNCTION public.portal_odres_identificado(p_cpf text)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS(SELECT 1 FROM public.portal_odres_listas l JOIN public.portal_odres_cpfs c ON c.lista_id=l.id
                WHERE l.tenant_id='00000000-0000-0000-0000-000000000001' AND l.ativo AND c.cpf=p_cpf)
      OR EXISTS(SELECT 1 FROM public.ume_carteira_parcelas u
                WHERE u.carteira='217490215' AND u.cpf IN (p_cpf, ltrim(p_cpf,'0')))
$function$;