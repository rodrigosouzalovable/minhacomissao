CREATE TABLE public.meta_auto_resposta_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origem text NOT NULL,
  mensagem_chave text NOT NULL,
  instancia_id uuid NOT NULL,
  telefone_normalizado text NOT NULL,
  detectado_em timestamptz NOT NULL DEFAULT now(),
  criado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meta_auto_resposta_eventos_origem_check CHECK (origem IN ('meta', 'uazapi')),
  CONSTRAINT meta_auto_resposta_eventos_origem_mensagem_unique UNIQUE (origem, mensagem_chave)
);

GRANT ALL ON public.meta_auto_resposta_eventos TO service_role;

ALTER TABLE public.meta_auto_resposta_eventos ENABLE ROW LEVEL SECURITY;

CREATE INDEX meta_auto_resposta_eventos_instancia_data_idx
ON public.meta_auto_resposta_eventos (instancia_id, detectado_em DESC);

CREATE INDEX meta_whatsapp_mensagens_saida_sufixo_data_idx
ON public.meta_whatsapp_mensagens (instancia_id, right(regexp_replace(coalesce(telefone, ''), '\D', '', 'g'), 8), timestamp_msg DESC)
WHERE direcao = 'saida';

CREATE INDEX whatsapp_mensagens_saida_sufixo_data_idx
ON public.whatsapp_mensagens (instancia_id, right(regexp_replace(coalesce(telefone_remoto, ''), '\D', '', 'g'), 8), timestamp_msg DESC)
WHERE direcao = 'saida';

CREATE OR REPLACE FUNCTION public.registrar_auto_resposta_geral(
  _origem text,
  _mensagem_chave text,
  _instancia_id uuid,
  _telefone_normalizado text,
  _telefone text,
  _resposta text,
  _motivo text,
  _confianca integer,
  _detectado_em timestamptz DEFAULT now(),
  _nome text DEFAULT NULL,
  _nicho text DEFAULT NULL,
  _cidade text DEFAULT NULL,
  _lead_id uuid DEFAULT NULL,
  _log_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  evento_inserido uuid;
  registro_id uuid;
  telefone_limpo text;
  telefone_sufixo text;
BEGIN
  telefone_limpo := regexp_replace(coalesce(_telefone_normalizado, _telefone, ''), '\D', '', 'g');
  telefone_sufixo := right(telefone_limpo, 8);

  IF _origem NOT IN ('meta', 'uazapi') OR coalesce(trim(_mensagem_chave), '') = '' OR length(telefone_sufixo) <> 8 THEN
    RETURN false;
  END IF;

  INSERT INTO public.meta_auto_resposta_eventos (
    origem, mensagem_chave, instancia_id, telefone_normalizado, detectado_em
  ) VALUES (
    _origem, _mensagem_chave, _instancia_id, telefone_limpo, coalesce(_detectado_em, now())
  )
  ON CONFLICT (origem, mensagem_chave) DO NOTHING
  RETURNING id INTO evento_inserido;

  IF evento_inserido IS NULL THEN
    RETURN false;
  END IF;

  IF _log_id IS NOT NULL THEN
    UPDATE public.meta_aquecimento_destino_log
    SET auto_resposta_confirmada = true
    WHERE id = _log_id;
  END IF;

  IF _lead_id IS NOT NULL THEN
    UPDATE public.google_maps_leads
    SET resultado_aquecimento = 'resposta_automatica'
    WHERE id = _lead_id;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(telefone_sufixo));

  SELECT id
  INTO registro_id
  FROM public.meta_aquecimento_auto_respondedores
  WHERE right(regexp_replace(telefone_normalizado, '\D', '', 'g'), 8) = telefone_sufixo
  ORDER BY ultima_deteccao_em DESC
  LIMIT 1
  FOR UPDATE;

  IF registro_id IS NULL THEN
    INSERT INTO public.meta_aquecimento_auto_respondedores (
      telefone_normalizado, telefone, lead_id, nome, nicho, cidade,
      primeira_deteccao_em, ultima_deteccao_em, quantidade_respostas,
      ultima_resposta, motivo_classificacao, confianca, instancia_id, atualizado_em
    ) VALUES (
      telefone_limpo, coalesce(nullif(_telefone, ''), telefone_limpo), _lead_id,
      nullif(trim(coalesce(_nome, '')), ''), nullif(trim(coalesce(_nicho, '')), ''), nullif(trim(coalesce(_cidade, '')), ''),
      coalesce(_detectado_em, now()), coalesce(_detectado_em, now()), 1,
      left(coalesce(_resposta, ''), 1000), coalesce(_motivo, 'resposta automática confirmada'),
      least(100, greatest(0, coalesce(_confianca, 0))), _instancia_id, now()
    );
  ELSE
    UPDATE public.meta_aquecimento_auto_respondedores
    SET telefone_normalizado = CASE WHEN length(telefone_limpo) >= length(telefone_normalizado) THEN telefone_limpo ELSE telefone_normalizado END,
        telefone = CASE WHEN length(telefone_limpo) >= length(regexp_replace(coalesce(telefone, ''), '\D', '', 'g')) THEN coalesce(nullif(_telefone, ''), telefone_limpo) ELSE telefone END,
        lead_id = coalesce(_lead_id, lead_id),
        nome = coalesce(nullif(trim(coalesce(_nome, '')), ''), nome),
        nicho = coalesce(nullif(trim(coalesce(_nicho, '')), ''), nicho),
        cidade = coalesce(nullif(trim(coalesce(_cidade, '')), ''), cidade),
        ultima_deteccao_em = greatest(ultima_deteccao_em, coalesce(_detectado_em, now())),
        quantidade_respostas = quantidade_respostas + 1,
        ultima_resposta = left(coalesce(_resposta, ''), 1000),
        motivo_classificacao = coalesce(_motivo, motivo_classificacao),
        confianca = greatest(confianca, least(100, greatest(0, coalesce(_confianca, 0)))),
        instancia_id = _instancia_id,
        atualizado_em = now()
    WHERE id = registro_id;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_auto_resposta_geral(text, text, uuid, text, text, text, text, integer, timestamptz, text, text, text, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_auto_resposta_geral(text, text, uuid, text, text, text, text, integer, timestamptz, text, text, text, uuid, uuid) TO service_role;