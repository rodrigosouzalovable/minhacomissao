CREATE OR REPLACE FUNCTION public.buscar_aberturas_cnpj_certificado_por_telefone(p_suffixes text[])
RETURNS TABLE(suffix text, data_abertura date)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH wanted AS (
    SELECT DISTINCT right(regexp_replace(s, '\D', '', 'g'), 8) AS suffix
    FROM unnest(p_suffixes) AS s
    WHERE length(regexp_replace(s, '\D', '', 'g')) >= 8
    LIMIT 300
  ), matches AS (
    SELECT DISTINCT ON (w.suffix)
      w.suffix,
      l.data_abertura::date AS data_abertura
    FROM wanted w
    JOIN public.certificado_leads l
      ON right(regexp_replace(coalesce(l.telefone_principal, ''), '\D', '', 'g'), 8) = w.suffix
    WHERE public.can_access_meta_folder(auth.uid(), '9267b296-24e6-425d-9f0e-0e4114c782d9'::uuid)
      AND l.data_abertura IS NOT NULL
    ORDER BY w.suffix, l.created_at DESC
  )
  SELECT matches.suffix, matches.data_abertura
  FROM matches
$$;

REVOKE ALL ON FUNCTION public.buscar_aberturas_cnpj_certificado_por_telefone(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.buscar_aberturas_cnpj_certificado_por_telefone(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.buscar_aberturas_cnpj_certificado_por_telefone(text[]) TO service_role;