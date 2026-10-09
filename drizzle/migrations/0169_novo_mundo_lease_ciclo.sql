ALTER TABLE public.meta_novo_mundo_config ADD COLUMN lease_token uuid, ADD COLUMN lease_ate timestamptz;
CREATE OR REPLACE FUNCTION public.claim_base_novo_mundo(p_owner uuid,p_token uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_owner uuid;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Acesso interno obrigatório'; END IF;
 UPDATE public.meta_novo_mundo_config SET lease_token=p_token,lease_ate=now()+interval '3 minutes' WHERE user_id=p_owner AND ativo AND (lease_ate IS NULL OR lease_ate<now()) RETURNING user_id INTO v_owner;
 RETURN v_owner IS NOT NULL;
END $$;
REVOKE ALL ON FUNCTION public.claim_base_novo_mundo(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_base_novo_mundo(uuid,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.release_base_novo_mundo(p_owner uuid,p_token uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Acesso interno obrigatório'; END IF;
 UPDATE public.meta_novo_mundo_config SET lease_token=NULL,lease_ate=NULL WHERE user_id=p_owner AND lease_token=p_token;
END $$;
REVOKE ALL ON FUNCTION public.release_base_novo_mundo(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.release_base_novo_mundo(uuid,uuid) TO service_role;