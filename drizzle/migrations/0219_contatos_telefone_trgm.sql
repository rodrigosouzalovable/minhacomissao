CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
CREATE INDEX IF NOT EXISTS idx_meta_contatos_telefone_trgm ON public.meta_whatsapp_contatos USING gin (telefone extensions.gin_trgm_ops);