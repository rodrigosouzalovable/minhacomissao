ALTER TABLE public.meta_templates_mestre
  ADD COLUMN IF NOT EXISTS reclassificado_marketing boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS categoria_meta text;

ALTER TABLE public.meta_aquecimento_trilha
  ADD COLUMN IF NOT EXISTS modo_intensivo boolean NOT NULL DEFAULT false;

ALTER TABLE public.meta_whatsapp_instances
  ADD COLUMN IF NOT EXISTS pausa_automatica_motivo text;