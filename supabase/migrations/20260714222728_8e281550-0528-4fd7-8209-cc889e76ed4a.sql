
-- === 1. Métricas diárias por instância Meta (guardrails + observabilidade) ===
CREATE TABLE IF NOT EXISTS public.meta_instance_daily_metrics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instancia_id uuid NOT NULL REFERENCES public.meta_whatsapp_instances(id) ON DELETE CASCADE,
  data date NOT NULL,
  enviadas integer NOT NULL DEFAULT 0,
  entregues integer NOT NULL DEFAULT 0,
  lidas integer NOT NULL DEFAULT 0,
  falharam integer NOT NULL DEFAULT 0,
  bloqueadas integer NOT NULL DEFAULT 0,
  inbound integer NOT NULL DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instancia_id, data)
);
CREATE INDEX IF NOT EXISTS idx_meta_daily_inst_data ON public.meta_instance_daily_metrics(instancia_id, data DESC);

GRANT SELECT ON public.meta_instance_daily_metrics TO authenticated;
GRANT ALL ON public.meta_instance_daily_metrics TO service_role;

ALTER TABLE public.meta_instance_daily_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_meta_daily_metrics"
  ON public.meta_instance_daily_metrics FOR SELECT TO authenticated
  USING (public.is_admin_user(auth.uid()));

-- === 2. RPC atômico pra incrementar métricas (usado pelo webhook) ===
CREATE OR REPLACE FUNCTION public.meta_metric_bump(
  _instancia_id uuid,
  _campo text,
  _inc integer DEFAULT 1
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF _campo NOT IN ('enviadas','entregues','lidas','falharam','bloqueadas','inbound') THEN
    RAISE EXCEPTION 'campo inválido: %', _campo;
  END IF;

  INSERT INTO public.meta_instance_daily_metrics (instancia_id, data)
  VALUES (_instancia_id, v_hoje)
  ON CONFLICT (instancia_id, data) DO NOTHING;

  EXECUTE format(
    'UPDATE public.meta_instance_daily_metrics SET %I = %I + $1, atualizado_em = now() WHERE instancia_id = $2 AND data = $3',
    _campo, _campo
  ) USING _inc, _instancia_id, v_hoje;
END;
$$;

-- === 3. Pares de aquecimento entre instâncias Meta próprias ===
CREATE TABLE IF NOT EXISTS public.meta_aquecimento_pares (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  emissor_id uuid NOT NULL REFERENCES public.meta_whatsapp_instances(id) ON DELETE CASCADE,
  receptor_id uuid NOT NULL REFERENCES public.meta_whatsapp_instances(id) ON DELETE CASCADE,
  trocas_hoje integer NOT NULL DEFAULT 0,
  trocas_total integer NOT NULL DEFAULT 0,
  ultima_troca_em timestamptz,
  ultimo_reset date,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (emissor_id, receptor_id),
  CHECK (emissor_id <> receptor_id)
);
CREATE INDEX IF NOT EXISTS idx_meta_pares_emissor ON public.meta_aquecimento_pares(emissor_id);

GRANT SELECT ON public.meta_aquecimento_pares TO authenticated;
GRANT ALL ON public.meta_aquecimento_pares TO service_role;

ALTER TABLE public.meta_aquecimento_pares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_meta_pares"
  ON public.meta_aquecimento_pares FOR SELECT TO authenticated
  USING (public.is_admin_user(auth.uid()));

-- === 4. Config do pool: novos toggles pra guardrails e aquecimento ===
ALTER TABLE public.meta_envio_pool_config
  ADD COLUMN IF NOT EXISTS aquecimento_ativo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS aquecimento_max_pares_dia integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS aquecimento_template_utility text,
  ADD COLUMN IF NOT EXISTS guardrail_ratio_inbound boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS guardrail_ratio_min_pct numeric NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS guardrail_block_rate_max_pct numeric NOT NULL DEFAULT 2;
