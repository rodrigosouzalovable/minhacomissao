ALTER TABLE public.cobmais_importacoes_diarias
  ADD COLUMN IF NOT EXISTS processador_token uuid,
  ADD COLUMN IF NOT EXISTS processador_lease_ate timestamptz,
  ADD COLUMN IF NOT EXISTS tentativas integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_cobmais_importacoes_em_processamento
  ON public.cobmais_importacoes_diarias (status, ultima_atividade_em)
  WHERE status IN ('validando', 'enviando', 'publicando');