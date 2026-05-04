
ALTER TABLE public.whatsapp_aquecimento_instancias
  ADD COLUMN IF NOT EXISTS mensagens_sem_resposta integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pausado_por_silencio boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_aqenv_autosave_inst_data
  ON public.aquecimento_envios_autosave (instancia_id, enviado_em DESC);
