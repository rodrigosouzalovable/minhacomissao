ALTER TABLE public.meta_templates_mestre ADD COLUMN IF NOT EXISTS injetar_em_novos boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_meta_templates_mestre_injetar ON public.meta_templates_mestre (injetar_em_novos) WHERE injetar_em_novos;
ALTER TABLE public.meta_templates_onboarding_config ADD COLUMN IF NOT EXISTS sem_limite_diario boolean NOT NULL DEFAULT true;