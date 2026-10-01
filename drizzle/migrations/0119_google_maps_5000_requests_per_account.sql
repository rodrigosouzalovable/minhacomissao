ALTER TABLE public.google_maps_api_keys
  ALTER COLUMN limite_maximo SET DEFAULT 5000,
  ALTER COLUMN limite_bloqueio SET DEFAULT 4750;

COMMENT ON COLUMN public.google_maps_api_keys.limite_maximo IS 'Monthly request allowance configured per independent Google Cloud account.';
COMMENT ON COLUMN public.google_maps_api_keys.limite_bloqueio IS 'Preventive monthly cutoff per account, set to 95 percent of its allowance.';
COMMENT ON COLUMN public.google_maps_auto_resposta_config.max_custo_usd_dia IS 'DEPRECATED: informational legacy estimate; no longer blocks capture because limits are enforced per Google Cloud account.';