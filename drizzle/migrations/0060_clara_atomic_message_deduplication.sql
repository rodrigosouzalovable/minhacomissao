CREATE OR REPLACE FUNCTION public.clara_claim_message(p_contato_id uuid, p_entrada_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contexto jsonb;
  v_processando_em timestamptz;
BEGIN
  IF p_contato_id IS NULL OR nullif(btrim(p_entrada_id), '') IS NULL THEN
    RETURN false;
  END IF;

  SELECT COALESCE(contexto, '{}'::jsonb)
    INTO v_contexto
  FROM public.clara_conversa_estado
  WHERE contato_id = p_contato_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF COALESCE(v_contexto->'entradas_processadas', '[]'::jsonb) ? p_entrada_id THEN
    RETURN false;
  END IF;

  v_processando_em := NULLIF(v_contexto->>'processando_em', '')::timestamptz;
  IF NULLIF(v_contexto->>'processando_entrada_id', '') IS NOT NULL
     AND v_processando_em IS NOT NULL
     AND v_processando_em > now() - interval '2 minutes' THEN
    RETURN false;
  END IF;

  UPDATE public.clara_conversa_estado
  SET contexto = v_contexto || jsonb_build_object(
        'processando_entrada_id', p_entrada_id,
        'processando_em', now()
      ),
      updated_at = now()
  WHERE contato_id = p_contato_id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.clara_finish_message(p_contato_id uuid, p_entrada_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contexto jsonb;
  v_processadas jsonb;
BEGIN
  SELECT COALESCE(contexto, '{}'::jsonb)
    INTO v_contexto
  FROM public.clara_conversa_estado
  WHERE contato_id = p_contato_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_processadas := COALESCE(v_contexto->'entradas_processadas', '[]'::jsonb);
  IF NOT (v_processadas ? p_entrada_id) THEN
    v_processadas := v_processadas || jsonb_build_array(p_entrada_id);
  END IF;

  SELECT COALESCE(jsonb_agg(item), '[]'::jsonb)
    INTO v_processadas
  FROM (
    SELECT item
    FROM jsonb_array_elements(v_processadas) WITH ORDINALITY AS x(item, ord)
    ORDER BY ord DESC
    LIMIT 50
  ) kept;

  v_contexto := (v_contexto - 'processando_entrada_id' - 'processando_em')
    || jsonb_build_object('entradas_processadas', v_processadas);

  UPDATE public.clara_conversa_estado
  SET contexto = v_contexto, updated_at = now()
  WHERE contato_id = p_contato_id;
END;
$$;

REVOKE ALL ON FUNCTION public.clara_claim_message(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.clara_finish_message(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clara_claim_message(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.clara_finish_message(uuid, text) TO service_role;