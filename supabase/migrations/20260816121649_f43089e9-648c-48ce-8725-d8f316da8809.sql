ALTER TABLE public.meta_business_managers
  ADD COLUMN IF NOT EXISTS tier_diario integer NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS tier_ilimitado boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_meta_instances_bm ON public.meta_whatsapp_instances(meta_bm_id);
CREATE INDEX IF NOT EXISTS idx_meta_envios_log_inst_data ON public.meta_whatsapp_envios_log(instancia_id, enviado_em DESC);

CREATE OR REPLACE FUNCTION public.meta_bm_uso_24h()
RETURNS TABLE (
  bm_id uuid,
  nome text,
  tier_diario integer,
  tier_ilimitado boolean,
  enviados_24h bigint,
  restantes bigint,
  instancias bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    b.id,
    b.nome,
    b.tier_diario,
    b.tier_ilimitado,
    COALESCE(u.qtd, 0)::bigint,
    CASE WHEN b.tier_ilimitado THEN 999999::bigint
         ELSE GREATEST(b.tier_diario - COALESCE(u.qtd, 0), 0)::bigint END,
    COALESCE(i.qtd, 0)::bigint
  FROM public.meta_business_managers b
  LEFT JOIN (
    SELECT ins.meta_bm_id AS bm, COUNT(*) AS qtd
    FROM public.meta_whatsapp_envios_log l
    JOIN public.meta_whatsapp_instances ins ON ins.id = l.instancia_id
    WHERE l.enviado_em > now() - interval '24 hours'
      AND COALESCE(l.status, '') <> 'failed'
      AND ins.meta_bm_id IS NOT NULL
    GROUP BY ins.meta_bm_id
  ) u ON u.bm = b.id
  LEFT JOIN (
    SELECT meta_bm_id AS bm, COUNT(*) AS qtd
    FROM public.meta_whatsapp_instances
    WHERE meta_bm_id IS NOT NULL
    GROUP BY meta_bm_id
  ) i ON i.bm = b.id
  ORDER BY b.nome;
$$;

GRANT EXECUTE ON FUNCTION public.meta_bm_uso_24h() TO authenticated, service_role;