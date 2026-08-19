ALTER TABLE public.virtualsms_config
  ADD COLUMN IF NOT EXISTS ultima_rejeicao_em timestamptz,
  ADD COLUMN IF NOT EXISTS ultima_rejeicao_motivo text,
  ADD COLUMN IF NOT EXISTS ultima_rejeicao_debug text;