REVOKE ALL ON public.meta_maps_aquecimento_consumidos FROM anon,authenticated;
CREATE OR REPLACE FUNCTION public.claim_reposicao_cadastral(p_owner uuid,p_token uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Acesso interno obrigatório'; END IF;
 IF EXISTS(SELECT 1 FROM public.meta_recuperacao_cadastral_destinos d WHERE d.user_id=p_owner AND d.fonte<>'uazapi' AND d.consumido_em IS NULL AND d.bloqueado_em IS NULL AND d.autorizado_em IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.meta_destinatario_supressao s WHERE s.telefone_sufixo=d.telefone_sufixo) AND NOT EXISTS(SELECT 1 FROM public.meta_maps_aquecimento_consumidos u WHERE u.telefone_sufixo=d.telefone_sufixo)) THEN RETURN false; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.meta_recuperacao_cadastral_destinos d WHERE d.user_id=p_owner AND d.fonte<>'uazapi' AND d.consumido_em IS NOT NULL) THEN RETURN false; END IF;
 UPDATE public.meta_recuperacao_cadastral_config SET reposicao_token=p_token,reposicao_em=now(),reposicao_resultado=NULL WHERE user_id=p_owner AND ativo AND (reposicao_em IS NULL OR reposicao_em<now()-interval '24 hours') RETURNING user_id INTO v_id;
 RETURN v_id IS NOT NULL;
END $$;
REVOKE ALL ON FUNCTION public.claim_reposicao_cadastral(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_reposicao_cadastral(uuid,uuid) TO service_role;