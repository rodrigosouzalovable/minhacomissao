CREATE TABLE public.google_maps_config (
  id SMALLINT PRIMARY KEY DEFAULT 1,
  api_key TEXT,
  updated_by UUID,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT google_maps_config_singleton CHECK (id = 1)
);

GRANT ALL ON public.google_maps_config TO service_role;

ALTER TABLE public.google_maps_config ENABLE ROW LEVEL SECURITY;

INSERT INTO public.google_maps_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;