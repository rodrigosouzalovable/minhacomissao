CREATE OR REPLACE FUNCTION public.clara_complete_message(
  p_contato_id uuid,
  p_entrada_id text,
  p_contexto jsonb,
  p_etapa text,
  p_optout boolean,
  p_aguardando_humano boolean,
  p_ultima_resposta_em timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contexto jsonb;
  v_processadas jsonb;
BEGIN
  IF p_contato_id IS NULL OR nullif(btrim(p_entrada_id), '') IS NULL THEN
    RETURN false;
  END IF;

  SELECT COALESCE(contexto, '{}'::jsonb) INTO v_contexto
  FROM public.clara_conversa_estado
  WHERE contato_id = p_contato_id
  FOR UPDATE;

  IF NOT FOUND OR v_contexto->>'processando_entrada_id' IS DISTINCT FROM p_entrada_id THEN
    RETURN false;
  END IF;

  v_processadas := COALESCE(v_contexto->'entradas_processadas', '[]'::jsonb);
  IF NOT (v_processadas ? p_entrada_id) THEN
    v_processadas := v_processadas || jsonb_build_array(p_entrada_id);
  END IF;

  SELECT COALESCE(jsonb_agg(item ORDER BY ord), '[]'::jsonb) INTO v_processadas
  FROM (
    SELECT item, ord
    FROM jsonb_array_elements(v_processadas) WITH ORDINALITY AS x(item, ord)
    ORDER BY ord DESC LIMIT 50
  ) kept;

  UPDATE public.clara_conversa_estado
  SET contexto = ((v_contexto || (COALESCE(p_contexto, '{}'::jsonb) - 'entradas_processadas' - 'processando_entrada_id' - 'processando_em'))
    - 'processando_entrada_id' - 'processando_em')
    || jsonb_build_object('entradas_processadas', v_processadas),
    etapa = p_etapa,
    optout = p_optout,
    aguardando_humano = p_aguardando_humano,
    ultima_resposta_em = p_ultima_resposta_em,
    updated_at = now()
  WHERE contato_id = p_contato_id;

  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.clara_complete_message(uuid, text, jsonb, text, boolean, boolean, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clara_complete_message(uuid, text, jsonb, text, boolean, boolean, timestamptz) TO service_role;