ALTER TABLE public.meta_whatsapp_contatos ADD COLUMN IF NOT EXISTS credor text;
ALTER TABLE public.envio_meta_job ADD COLUMN IF NOT EXISTS credor text;
ALTER TABLE public.envio_meta_job_item ADD COLUMN IF NOT EXISTS credor text;