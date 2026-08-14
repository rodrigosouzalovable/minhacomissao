ALTER TABLE public.meta_whatsapp_mensagens
  ADD COLUMN IF NOT EXISTS transcricao text,
  ADD COLUMN IF NOT EXISTS transcricao_status text;

CREATE INDEX IF NOT EXISTS idx_meta_msgs_audio_sem_transcricao
  ON public.meta_whatsapp_mensagens (instancia_id, criado_em DESC)
  WHERE tipo_conteudo = 'audio' AND transcricao IS NULL;