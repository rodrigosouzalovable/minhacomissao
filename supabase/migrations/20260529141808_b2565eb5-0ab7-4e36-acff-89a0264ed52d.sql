ALTER TABLE public.relatorio_acionamentos ADD COLUMN IF NOT EXISTS whatsapp INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.incrementar_metrica_acionamento(p_data date, p_hora text, p_coluna text)
 RETURNS relatorio_acionamentos
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid UUID := auth.uid();
  v_last TIMESTAMPTZ;
  v_old INTEGER;
  v_row public.relatorio_acionamentos;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'não autenticado';
  END IF;

  IF p_coluna NOT IN ('tentativas','whatsapp','alo','cpc','cpca') THEN
    RAISE EXCEPTION 'coluna inválida: %', p_coluna;
  END IF;

  SELECT MAX(created_at) INTO v_last
  FROM public.relatorio_acionamentos_log
  WHERE usuario_id = v_uid
    AND data = p_data
    AND hora = p_hora
    AND acao = 'incremento_' || p_coluna;

  IF v_last IS NOT NULL AND (now() - v_last) < INTERVAL '2 seconds' THEN
    RAISE EXCEPTION 'cooldown ativo, aguarde 2s';
  END IF;

  INSERT INTO public.relatorio_acionamentos (data, hora, atualizado_por)
  VALUES (p_data, p_hora, v_uid)
  ON CONFLICT (data, hora) DO NOTHING;

  EXECUTE format(
    'UPDATE public.relatorio_acionamentos SET %I = %I + 1, atualizado_em = now(), atualizado_por = $1 WHERE data = $2 AND hora = $3 RETURNING *',
    p_coluna, p_coluna
  ) INTO v_row USING v_uid, p_data, p_hora;

  v_old := CASE p_coluna
    WHEN 'tentativas' THEN v_row.tentativas - 1
    WHEN 'whatsapp' THEN v_row.whatsapp - 1
    WHEN 'alo' THEN v_row.alo - 1
    WHEN 'cpc' THEN v_row.cpc - 1
    WHEN 'cpca' THEN v_row.cpca - 1
  END;

  INSERT INTO public.relatorio_acionamentos_log
    (usuario_id, acao, data, hora, valor_anterior, valor_novo)
  VALUES (v_uid, 'incremento_' || p_coluna, p_data, p_hora, v_old, v_old + 1);

  RETURN v_row;
END;
$function$;