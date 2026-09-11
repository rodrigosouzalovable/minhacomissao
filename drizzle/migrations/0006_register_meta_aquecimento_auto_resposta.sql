ALTER TABLE public.meta_aquecimento_destino_log
ADD COLUMN auto_resposta_confirmada boolean NOT NULL DEFAULT false;

CREATE INDEX meta_aq_log_auto_resposta_idx
ON public.meta_aquecimento_destino_log (auto_resposta_confirmada, respondeu_em DESC)
WHERE fonte = 'lead' AND auto_resposta_confirmada = true;

CREATE OR REPLACE FUNCTION public.registrar_meta_aquecimento_auto_resposta(
  _log_id uuid,
  _telefone_normalizado text,
  _telefone text,
  _lead_id uuid,
  _nome text,
  _nicho text,
  _cidade text,
  _resposta text,
  _motivo text,
  _confianca integer,
  _instancia_id uuid,
  _detectado_em timestamptz DEFAULT now()
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.meta_aquecimento_destino_log
  SET auto_resposta_confirmada = true
  WHERE id = _log_id;

  IF _lead_id IS NOT NULL THEN
    UPDATE public.google_maps_leads
    SET resultado_aquecimento = 'resposta_automatica'
    WHERE id = _lead_id;
  END IF;

  INSERT INTO public.meta_aquecimento_auto_respondedores (
    telefone_normalizado, telefone, lead_id, nome, nicho, cidade,
    primeira_deteccao_em, ultima_deteccao_em, quantidade_respostas,
    ultima_resposta, motivo_classificacao, confianca, instancia_id, atualizado_em
  ) VALUES (
    _telefone_normalizado, _telefone, _lead_id, _nome, _nicho, _cidade,
    _detectado_em, _detectado_em, 1,
    _resposta, _motivo, LEAST(100, GREATEST(0, _confianca)), _instancia_id, now()
  )
  ON CONFLICT (telefone_normalizado) DO UPDATE SET
    telefone = EXCLUDED.telefone,
    lead_id = COALESCE(EXCLUDED.lead_id, public.meta_aquecimento_auto_respondedores.lead_id),
    nome = COALESCE(EXCLUDED.nome, public.meta_aquecimento_auto_respondedores.nome),
    nicho = COALESCE(EXCLUDED.nicho, public.meta_aquecimento_auto_respondedores.nicho),
    cidade = COALESCE(EXCLUDED.cidade, public.meta_aquecimento_auto_respondedores.cidade),
    ultima_deteccao_em = GREATEST(public.meta_aquecimento_auto_respondedores.ultima_deteccao_em, EXCLUDED.ultima_deteccao_em),
    quantidade_respostas = public.meta_aquecimento_auto_respondedores.quantidade_respostas + 1,
    ultima_resposta = EXCLUDED.ultima_resposta,
    motivo_classificacao = EXCLUDED.motivo_classificacao,
    confianca = GREATEST(public.meta_aquecimento_auto_respondedores.confianca, EXCLUDED.confianca),
    instancia_id = EXCLUDED.instancia_id,
    atualizado_em = now();
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_meta_aquecimento_auto_resposta(uuid, text, text, uuid, text, text, text, text, text, integer, uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_meta_aquecimento_auto_resposta(uuid, text, text, uuid, text, text, text, text, text, integer, uuid, timestamptz) TO service_role;