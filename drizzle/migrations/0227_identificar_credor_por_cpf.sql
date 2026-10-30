CREATE OR REPLACE FUNCTION public.identificar_credor_por_cpf(p_cpf text)
RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH c AS (SELECT lpad(regexp_replace(coalesce(p_cpf,''),'\D','','g'),11,'0') AS cpf)
  SELECT coalesce(array_agg(DISTINCT e), ARRAY[]::text[]) FROM (
    SELECT CASE WHEN u.carteira = '217490215' THEN 'odres_cred' ELSE 'mundo_da_moda' END AS e
      FROM public.ume_carteira_parcelas u, c
     WHERE u.cpf IN (c.cpf, ltrim(c.cpf,'0'))
    UNION
    SELECT 'ume_novo_mundo' FROM public.devedores d, c
     WHERE public.cpf_normalize(d.cpf) = public.cpf_normalize(c.cpf)
       AND d.ativo AND d.credor ILIKE 'ume_novo_mundo%'
  ) s
  WHERE auth.uid() IS NOT NULL AND length(regexp_replace(coalesce(p_cpf,''),'\D','','g')) = 11;
$$;
REVOKE ALL ON FUNCTION public.identificar_credor_por_cpf(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.identificar_credor_por_cpf(text) TO authenticated;