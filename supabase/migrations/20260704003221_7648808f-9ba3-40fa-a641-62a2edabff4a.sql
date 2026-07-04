
-- Extend meta_whatsapp_instances (ramp-up + pool + tier)
ALTER TABLE public.meta_whatsapp_instances
  ADD COLUMN IF NOT EXISTS data_ativacao_api timestamptz,
  ADD COLUMN IF NOT EXISTS fase_rampup text DEFAULT 'aguardando',
  ADD COLUMN IF NOT EXISTS pausa_automatica_ate timestamptz,
  ADD COLUMN IF NOT EXISTS pausa_automatica_motivo text,
  ADD COLUMN IF NOT EXISTS estado_pool text DEFAULT 'aguardando_templates',
  ADD COLUMN IF NOT EXISTS score_saude_cache numeric,
  ADD COLUMN IF NOT EXISTS messaging_limit_manual text,
  ADD COLUMN IF NOT EXISTS messaging_limit_source text DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS messaging_limit_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS throughput_level text;

-- Singleton pool config
CREATE TABLE IF NOT EXISTS public.meta_envio_pool_config (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  bloquear_domingo boolean NOT NULL DEFAULT true,
  horario_inicio time NOT NULL DEFAULT '08:00:00',
  horario_fim time NOT NULL DEFAULT '20:00:00',
  cota_fase1 integer NOT NULL DEFAULT 20,
  cota_fase2 integer NOT NULL DEFAULT 50,
  cota_fase3 integer NOT NULL DEFAULT 150,
  cota_fase4 integer NOT NULL DEFAULT 400,
  delay_min_mesmo_numero_seg integer NOT NULL DEFAULT 45,
  delay_max_mesmo_numero_seg integer NOT NULL DEFAULT 120,
  delay_min_entre_numeros_seg integer NOT NULL DEFAULT 3,
  delay_max_entre_numeros_seg integer NOT NULL DEFAULT 8,
  auto_pausa_yellow boolean NOT NULL DEFAULT true,
  auto_pausa_red_waba boolean NOT NULL DEFAULT true,
  duracao_pausa_yellow_horas integer NOT NULL DEFAULT 48,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_envio_pool_config TO authenticated;
GRANT ALL ON public.meta_envio_pool_config TO service_role;

ALTER TABLE public.meta_envio_pool_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage pool config" ON public.meta_envio_pool_config;
CREATE POLICY "Admins manage pool config" ON public.meta_envio_pool_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.meta_envio_pool_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Helper: effective daily quota (min of ramp-up phase quota and tier quota)
CREATE OR REPLACE FUNCTION public.get_effective_daily_quota(_instance_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inst public.meta_whatsapp_instances;
  cfg public.meta_envio_pool_config;
  dias integer;
  fase_quota integer;
  tier_str text;
  tier_quota integer;
BEGIN
  SELECT * INTO inst FROM public.meta_whatsapp_instances WHERE id = _instance_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  SELECT * INTO cfg FROM public.meta_envio_pool_config WHERE id = 1;

  -- Fase quota
  dias := CASE WHEN inst.data_ativacao_api IS NULL THEN 0
    ELSE GREATEST(1, FLOOR(EXTRACT(EPOCH FROM (now() - inst.data_ativacao_api))/86400)::int + 1)
  END;
  fase_quota := CASE
    WHEN inst.data_ativacao_api IS NULL THEN 0
    WHEN dias <= 3  THEN COALESCE(cfg.cota_fase1, 20)
    WHEN dias <= 7  THEN COALESCE(cfg.cota_fase2, 50)
    WHEN dias <= 14 THEN COALESCE(cfg.cota_fase3, 150)
    WHEN dias <= 21 THEN COALESCE(cfg.cota_fase4, 400)
    ELSE 999999
  END;

  -- Tier quota: manual > auto (saude_tier) > default TIER_1K
  tier_str := UPPER(COALESCE(inst.messaging_limit_manual, inst.saude_tier, 'TIER_1K'));
  tier_quota := CASE
    WHEN tier_str LIKE '%UNLIMITED%' THEN 999999
    WHEN tier_str LIKE '%100K%'      THEN 100000
    WHEN tier_str LIKE '%10K%'       THEN 10000
    WHEN tier_str LIKE '%2K%'        THEN 2000
    WHEN tier_str LIKE '%1K%'        THEN 1000
    WHEN tier_str LIKE '%250%'       THEN 250
    ELSE 1000
  END;

  RETURN LEAST(fase_quota, tier_quota);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_effective_daily_quota(uuid) TO authenticated, service_role;
