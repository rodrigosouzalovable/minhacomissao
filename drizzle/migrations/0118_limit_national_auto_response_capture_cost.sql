ALTER TABLE public.google_maps_auto_resposta_config
ADD COLUMN max_custo_usd_dia numeric(8,2) NOT NULL DEFAULT 20.80
CHECK (max_custo_usd_dia > 0 AND max_custo_usd_dia <= 20.80);

COMMENT ON COLUMN public.google_maps_auto_resposta_config.max_custo_usd_dia IS 'Hard daily estimated Google Places cost ceiling in USD for automatic-response candidate capture.';