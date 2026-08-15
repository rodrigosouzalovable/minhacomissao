ALTER TABLE public.iago_conversa_estado ADD COLUMN IF NOT EXISTS followup_etapa smallint NOT NULL DEFAULT 0;
ALTER TABLE public.iago_config ADD COLUMN IF NOT EXISTS followup2_ativo boolean NOT NULL DEFAULT true;
ALTER TABLE public.iago_config ADD COLUMN IF NOT EXISTS followup2_horas integer NOT NULL DEFAULT 12;
ALTER TABLE public.iago_config ADD COLUMN IF NOT EXISTS followup3_ativo boolean NOT NULL DEFAULT true;
ALTER TABLE public.iago_config ADD COLUMN IF NOT EXISTS followup3_horas integer NOT NULL DEFAULT 23;