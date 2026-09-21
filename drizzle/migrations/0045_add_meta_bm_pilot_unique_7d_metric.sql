ALTER TABLE public.meta_bm_escalada_diaria
  ADD COLUMN unicos_entregues_7d integer NOT NULL DEFAULT 0;

CREATE INDEX meta_aquecimento_destino_log_instancia_dia_idx
ON public.meta_aquecimento_destino_log (instancia_id, dia DESC);