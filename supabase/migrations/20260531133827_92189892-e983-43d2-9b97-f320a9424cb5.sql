CREATE OR REPLACE FUNCTION public.comite_carteira_nm_agregar()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_snap public.comite_carteira_nm_snapshot%ROWTYPE;
  v_result jsonb;
  v_por_faixa jsonb;
  v_por_tipo jsonb;
  v_matriz jsonb;
  v_total_contratos int := 0;
  v_total_cpfs int := 0;
  v_total_risco numeric := 0;
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'acesso negado';
  END IF;

  SELECT * INTO v_snap
  FROM public.comite_carteira_nm_snapshot
  WHERE ativo = true
  ORDER BY importado_em DESC
  LIMIT 1;

  IF v_snap.id IS NULL THEN
    RETURN jsonb_build_object(
      'snapshot', null,
      'por_faixa', '{}'::jsonb,
      'por_tipo', '{}'::jsonb,
      'matriz', '{}'::jsonb,
      'total_contratos', 0,
      'total_cpfs_unicos', 0,
      'total_risco', 0
    );
  END IF;

  SELECT count(*), count(DISTINCT cpf_cnpj), coalesce(sum(risco),0)
    INTO v_total_contratos, v_total_cpfs, v_total_risco
  FROM public.comite_carteira_nm_item
  WHERE snapshot_id = v_snap.id;

  SELECT coalesce(jsonb_object_agg(faixa, obj), '{}'::jsonb) INTO v_por_faixa
  FROM (
    SELECT faixa,
      jsonb_build_object(
        'qtd', count(*),
        'cpfs_unicos', count(DISTINCT cpf_cnpj),
        'risco', coalesce(sum(risco),0)
      ) AS obj
    FROM public.comite_carteira_nm_item
    WHERE snapshot_id = v_snap.id
    GROUP BY faixa
  ) t;

  SELECT coalesce(jsonb_object_agg(credor_tipo, obj), '{}'::jsonb) INTO v_por_tipo
  FROM (
    SELECT credor_tipo,
      jsonb_build_object(
        'qtd', count(*),
        'cpfs_unicos', count(DISTINCT cpf_cnpj),
        'risco', coalesce(sum(risco),0)
      ) AS obj
    FROM public.comite_carteira_nm_item
    WHERE snapshot_id = v_snap.id
    GROUP BY credor_tipo
  ) t;

  SELECT coalesce(jsonb_object_agg(faixa, tipos), '{}'::jsonb) INTO v_matriz
  FROM (
    SELECT faixa, jsonb_object_agg(credor_tipo, obj) AS tipos
    FROM (
      SELECT faixa, credor_tipo,
        jsonb_build_object(
          'qtd', count(*),
          'cpfs_unicos', count(DISTINCT cpf_cnpj),
          'risco', coalesce(sum(risco),0)
        ) AS obj
      FROM public.comite_carteira_nm_item
      WHERE snapshot_id = v_snap.id
      GROUP BY faixa, credor_tipo
    ) inner_t
    GROUP BY faixa
  ) outer_t;

  v_result := jsonb_build_object(
    'snapshot', to_jsonb(v_snap),
    'por_faixa', v_por_faixa,
    'por_tipo', v_por_tipo,
    'matriz', v_matriz,
    'total_contratos', v_total_contratos,
    'total_cpfs_unicos', v_total_cpfs,
    'total_risco', v_total_risco
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.comite_carteira_nm_agregar() TO authenticated;