ALTER TABLE public.meta_business_managers
  ADD COLUMN IF NOT EXISTS tier_manual boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.meta_tier_valor(t text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN t IS NULL OR t = '' THEN NULL
    WHEN upper(t) LIKE '%UNLIMITED%' OR upper(t) LIKE '%ILIMIT%' THEN 999999
    WHEN upper(t) LIKE '%100K%' THEN 100000
    WHEN upper(t) LIKE '%10K%' THEN 10000
    WHEN upper(t) LIKE '%2K%' THEN 2000
    WHEN upper(t) LIKE '%1K%' THEN 1000
    WHEN upper(t) LIKE '%250%' THEN 250
    ELSE NULL
  END
$$;

CREATE OR REPLACE FUNCTION public.meta_bm_uso_24h()
RETURNS TABLE(bm_id uuid, nome text, tier_diario integer, tier_ilimitado boolean, enviados_24h bigint, restantes bigint, instancias bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH inst AS (
    SELECT meta_bm_id AS bm,
           COUNT(*) AS qtd,
           MAX(public.meta_tier_valor(COALESCE(messaging_limit_manual, saude_tier))) AS tier_max
    FROM public.meta_whatsapp_instances
    WHERE meta_bm_id IS NOT NULL
    GROUP BY meta_bm_id
  ), uso AS (
    SELECT ins.meta_bm_id AS bm, COUNT(*) AS qtd
    FROM public.meta_whatsapp_envios_log l
    JOIN public.meta_whatsapp_instances ins ON ins.id = l.instancia_id
    WHERE l.enviado_em > now() - interval '24 hours'
      AND COALESCE(l.status, '') <> 'failed'
      AND ins.meta_bm_id IS NOT NULL
    GROUP BY ins.meta_bm_id
  ), calc AS (
    SELECT b.id, b.nome,
      CASE
        WHEN b.tier_ilimitado THEN 999999
        WHEN b.tier_manual THEN b.tier_diario
        ELSE COALESCE(i.tier_max, b.tier_diario)
      END AS limite_efetivo,
      (b.tier_ilimitado OR COALESCE(i.tier_max, 0) >= 999999) AS ilimitado,
      COALESCE(u.qtd, 0) AS enviados,
      COALESCE(i.qtd, 0) AS insts
    FROM public.meta_business_managers b
    LEFT JOIN inst i ON i.bm = b.id
    LEFT JOIN uso u ON u.bm = b.id
  )
  SELECT id, nome, limite_efetivo::integer, ilimitado,
         enviados::bigint,
         CASE WHEN ilimitado THEN 999999::bigint
              ELSE GREATEST(limite_efetivo - enviados, 0)::bigint END,
         insts::bigint
  FROM calc
  ORDER BY nome;
$$;