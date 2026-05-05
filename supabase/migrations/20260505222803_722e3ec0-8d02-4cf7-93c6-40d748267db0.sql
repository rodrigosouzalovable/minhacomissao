
ALTER TABLE public.whatsapp_aquecimento_status_log 
  ADD COLUMN IF NOT EXISTS proximo_post_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS imagem_id UUID,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'enviado',
  ADD COLUMN IF NOT EXISTS erro TEXT,
  ADD COLUMN IF NOT EXISTS postado_em TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_status_log_instancia ON public.whatsapp_aquecimento_status_log(instancia_id, postado_em DESC);
CREATE INDEX IF NOT EXISTS idx_status_log_proximo ON public.whatsapp_aquecimento_status_log(proximo_post_em);
