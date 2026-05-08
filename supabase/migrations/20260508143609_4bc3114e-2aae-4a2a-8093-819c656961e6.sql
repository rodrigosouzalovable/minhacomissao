ALTER TABLE public.whatsapp_aquecimento_grupo_membros 
  ADD COLUMN IF NOT EXISTS promovido_admin boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS promovido_em timestamptz NULL,
  ADD COLUMN IF NOT EXISTS promocao_erro text NULL;