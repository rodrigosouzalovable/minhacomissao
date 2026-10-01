CREATE OR REPLACE FUNCTION public.editar_parcela_acordo_proprio(
  p_pagamento_id uuid,
  p_novo_valor numeric DEFAULT NULL,
  p_nova_data_paga date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pagamento public.pagamentos%ROWTYPE;
  v_acordo public.acordos%ROWTYPE;
  v_novo_total numeric;
  v_nova_comissao_total numeric;
  v_nova_comissao_parcela numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Faça login para editar a parcela.' USING ERRCODE = '42501';
  END IF;

  SELECT p.* INTO v_pagamento
  FROM public.pagamentos p
  WHERE p.id = p_pagamento_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parcela não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  SELECT a.* INTO v_acordo
  FROM public.acordos a
  WHERE a.id = v_pagamento.acordo_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acordo não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  IF v_acordo.user_id <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Você só pode editar parcelas dos seus próprios acordos.' USING ERRCODE = '42501';
  END IF;

  IF p_novo_valor IS NULL AND p_nova_data_paga IS NULL THEN
    RAISE EXCEPTION 'Informe o novo valor ou a nova data de pagamento.' USING ERRCODE = '22023';
  END IF;

  IF p_novo_valor IS NOT NULL AND (p_novo_valor <= 0 OR p_novo_valor > 999999999) THEN
    RAISE EXCEPTION 'Informe um valor de parcela válido.' USING ERRCODE = '22023';
  END IF;

  IF p_nova_data_paga IS NOT NULL AND v_pagamento.status <> 'pago' THEN
    RAISE EXCEPTION 'A data de pagamento só pode ser alterada em parcelas pagas.' USING ERRCODE = '22023';
  END IF;

  v_nova_comissao_parcela := CASE
    WHEN p_novo_valor IS NULL THEN v_pagamento.comissao_parcela
    WHEN v_pagamento.valor_parcela > 0 THEN
      round(p_novo_valor * (v_pagamento.comissao_parcela / v_pagamento.valor_parcela), 2)
    ELSE
      round(p_novo_valor * (v_acordo.percentual_comissao / 100.0), 2)
  END;

  PERFORM set_config('app.edicao_acordo_proprietario', 'sim', true);

  UPDATE public.pagamentos
  SET valor_parcela = COALESCE(round(p_novo_valor, 2), valor_parcela),
      comissao_parcela = v_nova_comissao_parcela,
      data_paga = COALESCE(p_nova_data_paga, data_paga)
  WHERE id = p_pagamento_id
  RETURNING * INTO v_pagamento;

  SELECT round(COALESCE(sum(valor_parcela), 0), 2),
         round(COALESCE(sum(comissao_parcela), 0), 2)
  INTO v_novo_total, v_nova_comissao_total
  FROM public.pagamentos
  WHERE acordo_id = v_acordo.id;

  UPDATE public.acordos
  SET valor_total = v_novo_total,
      valor_parcela = CASE WHEN parcelas > 0 THEN round(v_novo_total / parcelas, 2) ELSE valor_parcela END,
      comissao_total = v_nova_comissao_total
  WHERE id = v_acordo.id
  RETURNING * INTO v_acordo;

  RETURN jsonb_build_object(
    'pagamento_id', v_pagamento.id,
    'valor_parcela', v_pagamento.valor_parcela,
    'comissao_parcela', v_pagamento.comissao_parcela,
    'data_paga', v_pagamento.data_paga,
    'valor_total', v_acordo.valor_total,
    'valor_medio_parcela', v_acordo.valor_parcela,
    'comissao_total', v_acordo.comissao_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.editar_parcela_acordo_proprio(uuid, numeric, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.editar_parcela_acordo_proprio(uuid, numeric, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.editar_parcela_acordo_proprio(uuid, numeric, date) TO service_role;