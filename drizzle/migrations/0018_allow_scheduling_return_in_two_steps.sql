CREATE OR REPLACE FUNCTION public.gm_atualizar_contato_lead(
  _atribuicao_id uuid,
  _contatado boolean,
  _resultado text DEFAULT NULL,
  _retorno_em timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _resultado IS NOT NULL AND _resultado NOT IN ('interessado', 'sem_interesse', 'nao_respondeu', 'retorno_agendado') THEN
    RAISE EXCEPTION 'Resultado inválido';
  END IF;

  UPDATE public.google_maps_lead_atribuicoes
  SET contatado_em = CASE WHEN _contatado THEN COALESCE(contatado_em, now()) ELSE NULL END,
      resultado = CASE WHEN _contatado THEN _resultado ELSE NULL END,
      retorno_em = CASE WHEN _contatado AND _resultado = 'retorno_agendado' THEN _retorno_em ELSE NULL END,
      atualizado_em = now()
  WHERE id = _atribuicao_id AND colaborador_id = auth.uid();

  IF NOT FOUND THEN RAISE EXCEPTION 'Lead não encontrado ou sem permissão'; END IF;
END;
$$;