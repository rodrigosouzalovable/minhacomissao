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
      AND ativo = true
      AND provider = 'meta'
    GROUP BY meta_bm_id
  ), uso AS (
    SELECT ins.meta_bm_id AS bm, COUNT(*) AS qtd
    FROM public.meta_whatsapp_envios_log l
    JOIN public.meta_whatsapp_instances ins ON ins.id = l.instancia_id
    WHERE l.enviado_em > now() - interval '24 hours'
      AND COALESCE(l.status, '') <> 'failed'
      AND ins.meta_bm_id IS NOT NULL
      AND ins.ativo = true
      AND ins.provider = 'meta'
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
    WHERE b.ativo = true
  )
  SELECT id, nome, limite_efetivo::integer, ilimitado,
         enviados::bigint,
         CASE WHEN ilimitado THEN 999999::bigint
              ELSE GREATEST(limite_efetivo - enviados, 0)::bigint END,
         insts::bigint
  FROM calc
  ORDER BY nome;
$$;

GRANT EXECUTE ON FUNCTION public.meta_bm_uso_24h() TO authenticated, service_role;