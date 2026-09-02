ALTER TABLE public.meta_whatsapp_instances
  ADD COLUMN IF NOT EXISTS qualidade_leitura_ok boolean,
  ADD COLUMN IF NOT EXISTS qualidade_leitura_erro text;