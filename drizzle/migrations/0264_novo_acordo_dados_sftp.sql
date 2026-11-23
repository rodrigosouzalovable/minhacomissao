ALTER TABLE public.ume_carteira_clientes ADD COLUMN IF NOT EXISTS telefones text[], ADD COLUMN IF NOT EXISTS telefones_lote date;

CREATE OR REPLACE FUNCTION public.ume_carteira_gravar_telefones(p_telefones jsonb)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' SET statement_timeout TO '120s'
AS $function$
DECLARE v_n integer := 0;
BEGIN
  IF NOT public.sftp_ume_pode() THEN RAISE EXCEPTION 'Apenas administradores.' USING ERRCODE = '42501'; END IF;
  UPDATE ume_carteira_clientes c SET
    telefone = t.tels[1],
    telefones = CASE WHEN c.telefones_lote = c.data_lote
      THEN (SELECT array_agg(DISTINCT x) FROM unnest(coalesce(c.telefones,'{}') || t.tels) x) ELSE t.tels END,
    telefones_lote = c.data_lote
  FROM (SELECT public.cpf_normalize(x->>'cpf') cpf, array_agg(DISTINCT x->>'telefone') tels
        FROM jsonb_array_elements(coalesce(p_telefones,'[]'::jsonb)) x
        WHERE coalesce(x->>'telefone','') <> '' GROUP BY 1) t
  WHERE c.cpf = t.cpf;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END $function$;

CREATE OR REPLACE FUNCTION public.novo_acordo_dados_sftp(p_cpf text)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_cpf text := public.cpf_normalize(p_cpf); c record; v_venc date; v_tels text[];
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff_member(auth.uid()) THEN RETURN NULL; END IF;
  SELECT * INTO c FROM ume_carteira_clientes WHERE cpf = v_cpf;
  IF NOT FOUND THEN RETURN jsonb_build_object('encontrado', false); END IF;
  SELECT min(vencimento) INTO v_venc FROM ume_carteira_parcelas WHERE cpf = v_cpf AND vencimento < v_hoje;
  v_tels := coalesce(c.telefones, CASE WHEN c.telefone IS NOT NULL THEN ARRAY[c.telefone] END, '{}');
  RETURN jsonb_build_object('encontrado', true,
    'carteira', c.carteira,
    'dias_atraso', CASE WHEN v_venc IS NULL THEN NULL ELSE v_hoje - v_venc END,
    'qtd_telefones', coalesce(array_length(v_tels,1),0),
    'telefone', CASE WHEN array_length(v_tels,1) = 1 THEN v_tels[1] END);
END $function$;
REVOKE ALL ON FUNCTION public.novo_acordo_dados_sftp(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.novo_acordo_dados_sftp(text) TO authenticated;