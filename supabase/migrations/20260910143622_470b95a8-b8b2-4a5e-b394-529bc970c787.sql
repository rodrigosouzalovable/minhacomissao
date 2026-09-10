ALTER TABLE public.meta_templates_instancia
  ADD COLUMN IF NOT EXISTS ultima_verificacao_em timestamptz,
  ADD COLUMN IF NOT EXISTS proxima_verificacao_em timestamptz,
  ADD COLUMN IF NOT EXISTS verificacoes integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_mti_proxima_verificacao
  ON public.meta_templates_instancia (proxima_verificacao_em)
  WHERE status IN ('PENDING', 'ENVIADO');

ALTER TABLE public.meta_whatsapp_instances
  ADD COLUMN IF NOT EXISTS templates_resync_pendente boolean NOT NULL DEFAULT false;