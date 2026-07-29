CREATE INDEX IF NOT EXISTS idx_devedor_telefones_suffix8_ativo
ON public.devedor_telefones ((right(regexp_replace(numero, '\D', '', 'g'), 8)))
WHERE ativo IS TRUE;

CREATE OR REPLACE FUNCTION public.buscar_nomes_crm_por_telefone_suffix(p_suffixes text[])
RETURNS TABLE(suffix text, nome text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH wanted AS (
    SELECT DISTINCT right(regexp_replace(s, '\D', '', 'g'), 8) AS suffix
    FROM unnest(p_suffixes) AS s
    WHERE length(regexp_replace(s, '\D', '', 'g')) >= 8
    LIMIT 200
  ), matches AS (
    SELECT DISTINCT ON (w.suffix)
      w.suffix,
      d.nome
    FROM wanted w
    JOIN public.devedor_telefones dt
      ON right(regexp_replace(dt.numero, '\D', '', 'g'), 8) = w.suffix
     AND dt.ativo IS TRUE
    JOIN public.devedores d
      ON public.cpf_normalize(d.cpf) = public.cpf_normalize(dt.devedor_cpf)
     AND d.ativo IS TRUE
     AND d.nome IS NOT NULL
    ORDER BY w.suffix, d.nome
  )
  SELECT matches.suffix, matches.nome
  FROM matches
$$;

GRANT EXECUTE ON FUNCTION public.buscar_nomes_crm_por_telefone_suffix(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.buscar_nomes_crm_por_telefone_suffix(text[]) TO service_role;