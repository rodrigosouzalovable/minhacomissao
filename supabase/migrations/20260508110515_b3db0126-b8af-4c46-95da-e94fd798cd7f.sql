ALTER TABLE public.whatsapp_aquecimento_grupo_membros 
  ADD COLUMN IF NOT EXISTS adicionado_por_instancia_id uuid NULL,
  ADD COLUMN IF NOT EXISTS bloqueado_ate timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_grupo_membros_adder_dia 
  ON public.whatsapp_aquecimento_grupo_membros (grupo_id, adicionado_por_instancia_id, adicionado_em);