ALTER TABLE public.meta_destinatario_supressao
  ADD COLUMN IF NOT EXISTS caixa_id uuid,
  ADD COLUMN IF NOT EXISTS caixa_nome text,
  ADD COLUMN IF NOT EXISTS origem_texto text;

CREATE INDEX IF NOT EXISTS idx_meta_destinatario_supressao_caixa
  ON public.meta_destinatario_supressao (caixa_id);

ALTER TABLE public.envio_meta_job
  ADD COLUMN IF NOT EXISTS bloqueados_blacklist jsonb NOT NULL DEFAULT '[]'::jsonb;