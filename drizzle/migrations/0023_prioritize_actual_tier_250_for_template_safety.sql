CREATE OR REPLACE FUNCTION public.meta_instance_template_tier(p_instancia_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.meta_tier_valor(i.saude_tier) = 250
      OR public.meta_tier_valor(i.messaging_limit_manual) = 250
      OR i.tier_diario = 250
      THEN 250
    WHEN b.tier_ilimitado THEN 999999
    WHEN b.tier_manual THEN b.tier_diario
    ELSE COALESCE(
      public.meta_tier_valor(i.saude_tier),
      public.meta_tier_valor(i.messaging_limit_manual),
      i.tier_diario,
      b.tier_diario,
      1000
    )
  END
  FROM public.meta_whatsapp_instances i
  LEFT JOIN public.meta_business_managers b ON b.id = i.meta_bm_id
  WHERE i.id = p_instancia_id
$$;

REVOKE ALL ON FUNCTION public.meta_instance_template_tier(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.meta_instance_template_tier(uuid) TO service_role;