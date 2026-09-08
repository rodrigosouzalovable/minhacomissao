ALTER TABLE public.envio_meta_job
  ADD COLUMN IF NOT EXISTS permitir_qualidade_baixa boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS saude_checada_em timestamptz,
  ADD COLUMN IF NOT EXISTS reabilitacao_checada_em timestamptz;