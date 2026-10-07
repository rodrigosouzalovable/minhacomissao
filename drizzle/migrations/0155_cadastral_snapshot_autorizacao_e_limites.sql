INSERT INTO public.meta_recuperacao_cadastral_config(user_id) SELECT id FROM public.profiles WHERE id='ee649720-b8ce-47a2-859e-100a3a9ae6bb' ON CONFLICT DO NOTHING;
INSERT INTO public.meta_recuperacao_cadastral_destinos(user_id,telefone_sufixo,telefone,nome_empresa,fonte,lead_id,autorizado_em,autorizacao_origem)
SELECT DISTINCT ON (l.user_id,right(regexp_replace(coalesce(l.telefone_internacional,l.telefone,''),'\D','','g'),8)) l.user_id,right(regexp_replace(coalesce(l.telefone_internacional,l.telefone,''),'\D','','g'),8),regexp_replace(coalesce(l.telefone_internacional,l.telefone,''),'\D','','g'),l.nome,CASE WHEN a.id IS NOT NULL THEN 'confirmado' ELSE 'candidato' END,l.id,now(),'Declaração do proprietário: estoque atual autorizado no plano cadastral de 07/10/2026; não extensível a capturas futuras'
FROM public.google_maps_leads l LEFT JOIN public.meta_aquecimento_auto_respondedores a ON a.lead_id=l.id LEFT JOIN public.google_maps_auto_resposta_candidatos c ON c.lead_id=l.id
WHERE l.user_id='ee649720-b8ce-47a2-859e-100a3a9ae6bb' AND l.tem_whatsapp=true AND length(trim(l.nome))>=3 AND length(regexp_replace(coalesce(l.telefone_internacional,l.telefone,''),'\D','','g'))>=10 AND (a.id IS NOT NULL OR c.id IS NOT NULL) AND NOT EXISTS(SELECT 1 FROM public.meta_destinatario_supressao s WHERE s.telefone_sufixo=right(regexp_replace(coalesce(l.telefone_internacional,l.telefone,''),'\D','','g'),8))
ORDER BY l.user_id,right(regexp_replace(coalesce(l.telefone_internacional,l.telefone,''),'\D','','g'),8),a.id NULLS LAST,l.created_at DESC ON CONFLICT DO NOTHING;
INSERT INTO public.meta_recuperacao_cadastral_destinos(user_id,telefone_sufixo,telefone,nome_empresa,fonte,destino_instancia_id,autorizado_em,autorizacao_origem)
SELECT i.user_id,right(regexp_replace(i.display_phone,'\D','','g'),8),regexp_replace(i.display_phone,'\D','','g'),i.nome,'uazapi',i.id,now(),'Números próprios autorizados na AQUECIMENTO: plano de 07/10/2026; nome empresarial exige validação'
FROM public.meta_whatsapp_instances i WHERE i.user_id='ee649720-b8ce-47a2-859e-100a3a9ae6bb' AND i.provider='uazapi' AND i.ativo AND i.folder_padrao_id='4f7a52c0-9c86-4b80-8867-4ade7a6df441' AND length(regexp_replace(coalesce(i.display_phone,''),'\D','','g'))>=10 AND length(trim(i.nome))>=3 ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION public.reservar_recuperacao_cadastral(p_instancia uuid,p_sufixo text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE i public.meta_whatsapp_instances%ROWTYPE; d public.meta_recuperacao_cadastral_destinos%ROWTYPE; v_id uuid; v_dia date := (now() AT TIME ZONE 'America/Sao_Paulo')::date; v_n integer; v_local timestamp := now() AT TIME ZONE 'America/Sao_Paulo';
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Acesso interno obrigatório'; END IF;
 IF extract(dow from v_local)=0 OR extract(hour from v_local)<8 OR extract(hour from v_local)>=19 THEN RETURN NULL; END IF;
 SELECT * INTO i FROM public.meta_whatsapp_instances WHERE id=p_instancia FOR UPDATE;
 IF NOT FOUND OR i.ativo IS DISTINCT FROM true OR i.provider IS DISTINCT FROM 'meta' OR i.recuperacao_ativa IS DISTINCT FROM true OR i.partner_client_id IS NOT NULL OR i.instancia_teste_aquecimento OR i.aquecimento_qualidade_permitido=false OR i.saude_status IS DISTINCT FROM 'CONNECTED' OR coalesce(i.saude_quality,'') NOT IN ('YELLOW','RED') THEN RETURN NULL; END IF;
 IF coalesce(i.saude_ban_info::text,'null') NOT IN ('null','{}','[]') OR coalesce(i.pausa_automatica_motivo,'') ~* '(131031|131042|payment|pagamento|billing|ban|blocked|account.lock|restri.*envio)' THEN RETURN NULL; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.meta_recuperacao_cadastral_config c WHERE c.user_id=i.user_id AND c.ativo) OR i.recuperacao_proximo_envio_em>now() THEN RETURN NULL; END IF;
 SELECT count(*) INTO v_n FROM public.meta_recuperacao_log WHERE instancia_id=i.id AND dia=v_dia AND status IN ('reservado','enviado');
 IF v_n>=least(20,greatest(1,coalesce(i.recuperacao_msgs_meta_dia,10))) THEN RETURN NULL; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.meta_templates_instancia t JOIN public.meta_templates_mestre m ON m.id=t.template_mestre_id WHERE t.instancia_id=i.id AND t.status='APPROVED' AND m.criado_por=i.user_id AND m.nome='fins_de_atualizacao_cadastral' AND m.categoria='UTILITY' AND NOT coalesce(m.reclassificado_marketing,false)) THEN RETURN NULL; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('cadastral:'||p_sufixo,0));
 SELECT * INTO d FROM public.meta_recuperacao_cadastral_destinos WHERE user_id=i.user_id AND telefone_sufixo=p_sufixo FOR UPDATE;
 IF NOT FOUND OR d.autorizado_em IS NULL OR d.bloqueado_em IS NOT NULL OR (d.fonte<>'uazapi' AND d.consumido_em IS NOT NULL) OR length(trim(d.nome_empresa))<3 THEN RETURN NULL; END IF;
 IF EXISTS(SELECT 1 FROM public.meta_destinatario_supressao s WHERE s.telefone_sufixo=p_sufixo) THEN RETURN NULL; END IF;
 IF d.fonte<>'uazapi' AND EXISTS(SELECT 1 FROM public.meta_recuperacao_cadastral_destinos x WHERE x.telefone_sufixo=p_sufixo AND x.fonte<>'uazapi' AND x.consumido_em IS NOT NULL) THEN RETURN NULL; END IF;
 IF d.lead_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.google_maps_leads l WHERE l.id=d.lead_id AND l.user_id=i.user_id AND l.tem_whatsapp=true) THEN RETURN NULL; END IF;
 IF d.fonte='uazapi' THEN
   IF NOT EXISTS(SELECT 1 FROM public.meta_whatsapp_instances x WHERE x.id=d.destino_instancia_id AND x.user_id=i.user_id AND x.ativo AND x.provider='uazapi' AND x.folder_padrao_id='4f7a52c0-9c86-4b80-8867-4ade7a6df441') THEN RETURN NULL; END IF;
   SELECT count(*) INTO v_n FROM public.meta_recuperacao_log WHERE dia=v_dia AND right(regexp_replace(coalesce(destino_telefone,''),'\D','','g'),8)=p_sufixo AND status IN ('reservado','enviado');
   IF v_n>=2 THEN RETURN NULL; END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM public.meta_whatsapp_contatos c WHERE c.instancia_id=i.id AND right(regexp_replace(c.telefone,'\D','','g'),8)=p_sufixo AND c.folder_id IS DISTINCT FROM '4f7a52c0-9c86-4b80-8867-4ade7a6df441'::uuid) THEN RETURN NULL; END IF;
 IF p_sufixo=right(regexp_replace(coalesce(i.display_phone,''),'\D','','g'),8) THEN RETURN NULL; END IF;
 INSERT INTO public.meta_recuperacao_log(instancia_id,destino_instancia_id,destino_telefone,tipo,status,dia,cadastral,fonte,lead_id,nome_empresa,telefone_sufixo,variaveis) VALUES(i.id,d.destino_instancia_id,d.telefone,'recuperacao:fins_de_atualizacao_cadastral','reservado',v_dia,true,d.fonte,d.lead_id,d.nome_empresa,p_sufixo,jsonb_build_array('tudo bem?',d.nome_empresa)) RETURNING id INTO v_id;
 UPDATE public.meta_recuperacao_cadastral_destinos SET consumido_em=now() WHERE user_id=d.user_id AND telefone_sufixo=p_sufixo AND d.fonte<>'uazapi';
 UPDATE public.meta_whatsapp_instances SET recuperacao_proximo_envio_em=now()+make_interval(secs=>1200+floor(random()*1201)::integer) WHERE id=i.id;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.reservar_recuperacao_cadastral(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reservar_recuperacao_cadastral(uuid,text) TO service_role;
CREATE OR REPLACE FUNCTION public.claim_agradecimento_cadastral(p_log uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Acesso interno obrigatório'; END IF;
 UPDATE public.meta_recuperacao_log l SET agradecimento_claim_em=now(),resposta_tipo='confirmacao',resposta_em=coalesce(resposta_em,now()) WHERE l.id=p_log AND l.cadastral AND l.status='enviado' AND l.agradecimento_claim_em IS NULL AND l.resposta_tipo IS DISTINCT FROM 'saida' AND l.resposta_tipo IS DISTINCT FROM 'negativa' AND NOT EXISTS(SELECT 1 FROM public.meta_destinatario_supressao s WHERE s.telefone_sufixo=l.telefone_sufixo) AND NOT EXISTS(SELECT 1 FROM public.meta_recuperacao_log x WHERE x.instancia_id=l.instancia_id AND x.telefone_sufixo=l.telefone_sufixo AND x.cadastral AND x.agradecimento_claim_em IS NOT NULL) RETURNING l.id INTO v_id;
 RETURN v_id IS NOT NULL;
END $$;
REVOKE ALL ON FUNCTION public.claim_agradecimento_cadastral(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_agradecimento_cadastral(uuid) TO service_role;