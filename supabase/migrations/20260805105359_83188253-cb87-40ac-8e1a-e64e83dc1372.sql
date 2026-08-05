ALTER TABLE public.relatorio_acionamentos
  ADD COLUMN IF NOT EXISTS whatsapp_auto integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cpc_auto integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cpca_auto integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tentativas_auto integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS whatsapp_manual boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cpc_manual boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cpca_manual boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tentativas_manual boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sync_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_meta_msgs_ts_direcao
  ON public.meta_whatsapp_mensagens (timestamp_msg, direcao);
