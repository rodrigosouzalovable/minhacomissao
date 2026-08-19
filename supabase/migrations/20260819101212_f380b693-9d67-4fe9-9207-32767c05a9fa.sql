ALTER TABLE public.virtualsms_pedidos
  ADD COLUMN IF NOT EXISTS texto_sms TEXT,
  ADD COLUMN IF NOT EXISTS recebido_em TIMESTAMPTZ;

ALTER TABLE public.virtualsms_config
  ADD COLUMN IF NOT EXISTS ultimo_evento_em TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_virtualsms_pedidos_numero ON public.virtualsms_pedidos (numero);