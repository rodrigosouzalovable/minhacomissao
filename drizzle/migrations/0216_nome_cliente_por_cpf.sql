CREATE OR REPLACE FUNCTION public.nome_cliente_por_cpf(p_cpf text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH c AS (SELECT regexp_replace(coalesce(p_cpf,''), '\D', '', 'g') d)
  SELECT upper(btrim(n)) FROM (
    SELECT nome n, 1 o FROM ume_carteira_clientes, c WHERE auth.uid() IS NOT NULL AND cpf = c.d AND coalesce(btrim(nome),'') <> ''
    UNION ALL
    SELECT nome, 2 FROM devedores, c WHERE auth.uid() IS NOT NULL AND regexp_replace(cpf,'\D','','g') = c.d AND coalesce(btrim(nome),'') <> ''
  ) x ORDER BY o LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.nome_cliente_por_cpf(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.nome_cliente_por_cpf(text) TO authenticated;