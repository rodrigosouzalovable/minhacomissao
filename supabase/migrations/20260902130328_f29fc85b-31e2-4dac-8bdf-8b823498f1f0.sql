ALTER TABLE public.envio_meta_job_item
  ADD COLUMN IF NOT EXISTS template_id_resolvido uuid,
  ADD COLUMN IF NOT EXISTS template_nome_enviado text;