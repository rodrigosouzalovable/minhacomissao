ALTER TABLE public.meta_envio_pool_config
  ADD COLUMN IF NOT EXISTS guardiao_ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS guardiao_janela_horas integer NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS guardiao_min_saidas integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS resp_pct_atencao numeric NOT NULL DEFAULT 18,
  ADD COLUMN IF NOT EXISTS resp_pct_forte numeric NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS resp_pct_corte numeric NOT NULL DEFAULT 8;

ALTER TABLE public.meta_instance_freio_diario
  ADD COLUMN IF NOT EXISTS guardiao_faixa text,
  ADD COLUMN IF NOT EXISTS guardiao_fator numeric,
  ADD COLUMN IF NOT EXISTS guardiao_resposta_pct numeric,
  ADD COLUMN IF NOT EXISTS guardiao_atualizado_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_meta_msgs_inst_criado_direcao
  ON public.meta_whatsapp_mensagens (instancia_id, criado_em DESC, direcao);