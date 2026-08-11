CREATE INDEX IF NOT EXISTS idx_meta_contatos_inbox_default
  ON public.meta_whatsapp_contatos (arquivado, ultima_mensagem_em DESC NULLS LAST)
  WHERE folder_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_meta_contatos_inbox_folder
  ON public.meta_whatsapp_contatos (folder_id, arquivado, ultima_mensagem_em DESC NULLS LAST)
  WHERE folder_id IS NOT NULL;