ALTER TABLE public.meta_whatsapp_instances
  ADD COLUMN IF NOT EXISTS aquecimento_qualidade_permitido boolean NOT NULL DEFAULT true;

-- Números vinculados a parceiros Meta não entram no aquecimento automático de qualidade
UPDATE public.meta_whatsapp_instances i
SET aquecimento_qualidade_permitido = false
WHERE EXISTS (SELECT 1 FROM public.meta_instance_parceiros mp WHERE mp.instancia_id = i.id);

CREATE INDEX IF NOT EXISTS idx_meta_inst_recup_permitido
  ON public.meta_whatsapp_instances (recuperacao_ativa, aquecimento_qualidade_permitido)
  WHERE ativo = true;

CREATE INDEX IF NOT EXISTS idx_meta_recuperacao_log_dia_inst
  ON public.meta_recuperacao_log (dia, instancia_id);