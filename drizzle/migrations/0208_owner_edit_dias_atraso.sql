CREATE OR REPLACE FUNCTION public.percentual_comissao_por_atraso(p_dias integer)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN p_dias IS NULL OR p_dias < 1 THEN 0
    WHEN p_dias <= 30 THEN 7 WHEN p_dias <= 60 THEN 8 WHEN p_dias <= 90 THEN 15
    WHEN p_dias <= 180 THEN 20 WHEN p_dias <= 360 THEN 27 WHEN p_dias <= 720 THEN 36
    ELSE 50 END::numeric
$$;

CREATE OR REPLACE FUNCTION public.editar_dias_atraso_acordo_proprio(p_acordo_id uuid, p_dias_atraso integer)
RETURNS public.acordos LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_acordo public.acordos%ROWTYPE; v_pct numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login para editar.' USING ERRCODE = '42501'; END IF;
  IF p_dias_atraso IS NULL OR p_dias_atraso < 0 OR p_dias_atraso > 9999 THEN
    RAISE EXCEPTION 'Dias de atraso inválidos.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_acordo FROM public.acordos WHERE id = p_acordo_id FOR UPDATE;
  IF NOT FOUND OR (v_acordo.user_id <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Você só pode editar seus próprios acordos.' USING ERRCODE = '42501';
  END IF;
  IF v_acordo.dias_atraso = p_dias_atraso THEN RETURN v_acordo; END IF;
  v_pct := public.percentual_comissao_por_atraso(p_dias_atraso);
  PERFORM set_config('app.edicao_pagamento_global', 'sim', true);
  UPDATE public.pagamentos SET comissao_parcela = round(valor_parcela * v_pct / 100.0, 2) WHERE acordo_id = p_acordo_id;
  UPDATE public.acordos SET dias_atraso = p_dias_atraso, percentual_comissao = v_pct,
    comissao_total = (SELECT coalesce(sum(comissao_parcela), 0) FROM public.pagamentos WHERE acordo_id = p_acordo_id)
  WHERE id = p_acordo_id RETURNING * INTO v_acordo;
  PERFORM set_config('app.edicao_pagamento_global', '', true);
  RETURN v_acordo;
END;
$$;
REVOKE ALL ON FUNCTION public.editar_dias_atraso_acordo_proprio(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.editar_dias_atraso_acordo_proprio(uuid, integer) TO authenticated;