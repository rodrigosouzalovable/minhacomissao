ALTER TABLE public.meta_aquecimento_destino_log
  ADD COLUMN IF NOT EXISTS resposta_classificacao text,
  ADD COLUMN IF NOT EXISTS resposta_texto text;

ALTER TABLE public.meta_aquecimento_destino_log
  ADD CONSTRAINT meta_aquecimento_resposta_classificacao_check
  CHECK (
    resposta_classificacao IS NULL OR resposta_classificacao IN (
      'automatica', 'positiva', 'negativa', 'numero_errado', 'optout', 'humana_neutra'
    )
  );

CREATE INDEX IF NOT EXISTS idx_meta_aquecimento_resposta_classificacao
  ON public.meta_aquecimento_destino_log (resposta_classificacao, respondeu_em DESC)
  WHERE resposta_classificacao IS NOT NULL;

COMMENT ON COLUMN public.meta_aquecimento_destino_log.resposta_classificacao IS
  'Classificação operacional da primeira resposta: automática, positiva, negativa, número errado, opt-out ou humana neutra.';

COMMENT ON COLUMN public.meta_aquecimento_destino_log.resposta_texto IS
  'Trecho da primeira resposta usado para auditoria da classificação.';