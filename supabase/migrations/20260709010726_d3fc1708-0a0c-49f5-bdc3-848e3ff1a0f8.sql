
ALTER TABLE public.meta_templates_mestre
  ADD COLUMN IF NOT EXISTS cabecalho_media_url text,
  ADD COLUMN IF NOT EXISTS cabecalho_media_mime text;

ALTER TABLE public.meta_templates_instancia
  ADD COLUMN IF NOT EXISTS header_handle text;
