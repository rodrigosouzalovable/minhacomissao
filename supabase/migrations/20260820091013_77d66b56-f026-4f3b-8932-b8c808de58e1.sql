ALTER TABLE public.whatsapp_chamadas
  ADD COLUMN IF NOT EXISTS sdp_offer text,
  ADD COLUMN IF NOT EXISTS sdp_answer text,
  ADD COLUMN IF NOT EXISTS atualizado_em timestamptz NOT NULL DEFAULT now();