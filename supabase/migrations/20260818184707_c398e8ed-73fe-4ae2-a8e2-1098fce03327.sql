ALTER TABLE public.iago_config
  ADD COLUMN IF NOT EXISTS desconto_avista_pct numeric,
  ADD COLUMN IF NOT EXISTS desconto_parcelado_pct numeric;