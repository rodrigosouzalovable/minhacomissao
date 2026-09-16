ALTER TABLE public.google_maps_api_keys
  ALTER COLUMN limite_maximo SET DEFAULT 1000,
  ALTER COLUMN limite_bloqueio SET DEFAULT 950;