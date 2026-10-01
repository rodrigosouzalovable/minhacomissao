CREATE OR REPLACE FUNCTION public.gm_registrar_candidatos_auto_resposta(p_itens jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_inseridos integer := 0;
BEGIN
  INSERT INTO public.google_maps_auto_resposta_candidatos (
    lead_id, telefone_normalizado, telefone, nome, nicho, cidade, avaliacao,
    total_avaliacoes, site, pontuacao, motivo_pontuacao, status
  )
  SELECT
    (x->>'lead_id')::uuid,
    regexp_replace(x->>'telefone_normalizado', '\D', '', 'g'),
    x->>'telefone', nullif(x->>'nome', ''), nullif(x->>'nicho', ''), nullif(x->>'cidade', ''),
    nullif(x->>'avaliacao', '')::numeric, nullif(x->>'total_avaliacoes', '')::integer,
    nullif(x->>'site', ''), coalesce(nullif(x->>'pontuacao', '')::numeric, 0),
    nullif(x->>'motivo_pontuacao', ''), 'novo'
  FROM jsonb_array_elements(coalesce(p_itens, '[]'::jsonb)) AS x
  WHERE length(right(regexp_replace(x->>'telefone_normalizado', '\D', '', 'g'), 8)) = 8
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_inseridos = ROW_COUNT;
  RETURN v_inseridos;
END;
$$;
REVOKE ALL ON FUNCTION public.gm_registrar_candidatos_auto_resposta(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gm_registrar_candidatos_auto_resposta(jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.gm_auto_resposta_ranking()
RETURNS TABLE(nicho text, cidade text, amostra bigint, confirmados bigint, taxa numeric, score numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      CASE
        WHEN lower(coalesce(b.categoria, l.categoria, '')) ~ 'veterin' THEN 'clínica veterinária'
        WHEN lower(coalesce(b.categoria, l.categoria, '')) ~ 'pet[ -]?shop' THEN 'pet shop'
        WHEN lower(coalesce(b.categoria, l.categoria, '')) ~ 'contab|contáb' THEN 'contabilidade'
        WHEN lower(coalesce(b.categoria, l.categoria, '')) ~ 'odont' THEN 'clínica odontológica'
        WHEN lower(coalesce(b.categoria, l.categoria, '')) ~ 'psicol' THEN 'psicólogo'
        WHEN lower(coalesce(b.categoria, l.categoria, '')) ~ 'mec[aâ]nic|oficina' THEN 'oficina mecânica'
        WHEN lower(coalesce(b.categoria, l.categoria, '')) ~ 'academ' THEN 'academia'
        WHEN lower(coalesce(b.categoria, l.categoria, '')) ~ 'barbear' THEN 'barbearia'
        WHEN lower(coalesce(b.categoria, l.categoria, '')) ~ 'sal[aã]o|beleza' THEN 'salão de beleza'
        WHEN lower(coalesce(b.categoria, l.categoria, '')) ~ 'imobili' THEN 'imobiliária'
        ELSE lower(trim(coalesce(b.categoria, l.categoria, 'serviços')))
      END AS nicho,
      trim(coalesce(b.localizacao, 'Goiânia GO')) AS cidade,
      l.id,
      CASE WHEN a.id IS NOT NULL THEN 1 ELSE 0 END AS confirmou
    FROM public.google_maps_leads l
    JOIN public.google_maps_buscas b ON b.id = l.busca_id
    LEFT JOIN public.meta_aquecimento_auto_respondedores a ON a.lead_id = l.id
    WHERE l.tem_whatsapp IS TRUE
  )
  SELECT nicho, cidade, count(*) AS amostra, sum(confirmou)::bigint AS confirmados,
         round(sum(confirmou)::numeric / nullif(count(*), 0), 4) AS taxa,
         round(((sum(confirmou) + 3.0) / (count(*) + 20.0)) * 100, 2) AS score
  FROM base
  WHERE nicho <> ''
  GROUP BY nicho, cidade
  ORDER BY ((sum(confirmou) + 3.0) / (count(*) + 20.0)) DESC, count(*) DESC;
$$;
REVOKE ALL ON FUNCTION public.gm_auto_resposta_ranking() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gm_auto_resposta_ranking() TO service_role;