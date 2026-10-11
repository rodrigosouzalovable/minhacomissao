DO $$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.reserve_tier_250_template_slot(uuid,uuid,text)'::regprocedure) INTO definition;
 definition := replace(definition, 'WHERE f.instancia_id=p_instancia_id AND f.enviado_em >=', 'WHERE f.instancia_id=p_instancia_id AND f.template_mestre_id IS DISTINCT FROM p_template_mestre_id AND f.enviado_em >=');
 EXECUTE definition;
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_tier_250_template_slot(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_tier_250_template_slot(uuid,uuid,text) TO service_role;