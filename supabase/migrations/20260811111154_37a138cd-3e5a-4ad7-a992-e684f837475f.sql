ALTER TABLE public.meta_whatsapp_instances
  ADD COLUMN IF NOT EXISTS qualidade_liberada_manual boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS qualidade_liberada_em timestamptz;