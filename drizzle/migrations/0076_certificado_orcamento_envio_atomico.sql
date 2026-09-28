CREATE OR REPLACE FUNCTION public.certificado_reservar_orcamento_envio(p_dia date, p_custo numeric)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_reservado numeric;
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Acesso restrito ao processamento de envios';
  END IF;
  IF p_dia IS NULL OR p_dia <> (now() AT TIME ZONE 'America/Sao_Paulo')::date OR p_custo IS NULL OR p_custo <= 0 OR p_custo > 120 THEN
    RAISE EXCEPTION 'Data ou custo inválido';
  END IF;
  INSERT INTO public.meta_aquecimento_orcamento (dia, teto_reais, gasto_reais, custo_utility, custo_marketing)
  SELECT p_dia, LEAST(120, COALESCE(ultimo.teto_reais, 120)), 0,
         COALESCE(ultimo.custo_utility, 0.04), COALESCE(ultimo.custo_marketing, 0.20)
  FROM (SELECT 1) base
  LEFT JOIN LATERAL (
    SELECT teto_reais, custo_utility, custo_marketing
    FROM public.meta_aquecimento_orcamento
    WHERE dia < p_dia ORDER BY dia DESC LIMIT 1
  ) ultimo ON true
  ON CONFLICT (dia) DO NOTHING;
  UPDATE public.meta_aquecimento_orcamento
  SET gasto_reais = gasto_reais + p_custo, atualizado_em = now()
  WHERE dia = p_dia
    AND gasto_reais + p_custo <= LEAST(teto_reais, 120)
  RETURNING gasto_reais INTO v_reservado;
  RETURN v_reservado IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.certificado_reservar_orcamento_envio(date, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.certificado_reservar_orcamento_envio(date, numeric) TO service_role;