CREATE TABLE public.meta_recuperacao_cadastral_config (
 user_id uuid PRIMARY KEY REFERENCES public.profiles(id), ativo boolean NOT NULL DEFAULT false,
 reposicao_token uuid, reposicao_em timestamptz, reposicao_resultado jsonb,
 criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.meta_recuperacao_cadastral_config TO authenticated;
GRANT ALL ON public.meta_recuperacao_cadastral_config TO service_role;
ALTER TABLE public.meta_recuperacao_cadastral_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY cadastral_config_admin ON public.meta_recuperacao_cadastral_config FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') AND user_id=auth.uid());
CREATE TABLE public.meta_recuperacao_cadastral_destinos (
 user_id uuid NOT NULL REFERENCES public.profiles(id), telefone_sufixo text NOT NULL CHECK(length(telefone_sufixo)=8),
 telefone text NOT NULL, nome_empresa text NOT NULL,
 fonte text NOT NULL CHECK(fonte IN ('uazapi','confirmado','candidato')),
 lead_id uuid REFERENCES public.google_maps_leads(id), destino_instancia_id uuid REFERENCES public.meta_whatsapp_instances(id),
 autorizado_em timestamptz, autorizacao_origem text, consumido_em timestamptz, bloqueado_em timestamptz,
 criado_em timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,telefone_sufixo)
);
GRANT SELECT ON public.meta_recuperacao_cadastral_destinos TO authenticated;
GRANT ALL ON public.meta_recuperacao_cadastral_destinos TO service_role;
ALTER TABLE public.meta_recuperacao_cadastral_destinos ENABLE ROW LEVEL SECURITY;
CREATE POLICY cadastral_destinos_admin ON public.meta_recuperacao_cadastral_destinos FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin') AND user_id=auth.uid());
CREATE INDEX cadastral_destinos_disponiveis ON public.meta_recuperacao_cadastral_destinos(user_id,fonte,criado_em) WHERE consumido_em IS NULL AND bloqueado_em IS NULL AND autorizado_em IS NOT NULL;
ALTER TABLE public.meta_recuperacao_log ADD COLUMN IF NOT EXISTS cadastral boolean NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS fonte text, ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES public.google_maps_leads(id),
 ADD COLUMN IF NOT EXISTS nome_empresa text, ADD COLUMN IF NOT EXISTS telefone_sufixo text,
 ADD COLUMN IF NOT EXISTS contato_id uuid REFERENCES public.meta_whatsapp_contatos(id),
 ADD COLUMN IF NOT EXISTS variaveis jsonb, ADD COLUMN IF NOT EXISTS resposta_tipo text,
 ADD COLUMN IF NOT EXISTS agradecimento_claim_em timestamptz, ADD COLUMN IF NOT EXISTS agradecimento_wamid text,
 ADD COLUMN IF NOT EXISTS agradecimento_erro text, ADD COLUMN IF NOT EXISTS entregue_em timestamptz, ADD COLUMN IF NOT EXISTS lido_em timestamptz;
CREATE INDEX cadastral_log_conversa ON public.meta_recuperacao_log(instancia_id,telefone_sufixo,enviado_em DESC) WHERE cadastral;
CREATE INDEX cadastral_log_destino ON public.meta_recuperacao_log(telefone_sufixo,dia) WHERE cadastral;
CREATE OR REPLACE FUNCTION public.reservar_recuperacao_cadastral(p_instancia uuid,p_sufixo text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE i public.meta_whatsapp_instances%ROWTYPE; d public.meta_recuperacao_cadastral_destinos%ROWTYPE; v_id uuid; v_dia date := (now() AT TIME ZONE 'America/Sao_Paulo')::date; v_n integer; v_local timestamp := now() AT TIME ZONE 'America/Sao_Paulo';
BEGIN
 IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Acesso interno obrigatório'; END IF;
 IF extract(dow from v_local)=0 OR extract(hour from v_local)<8 OR extract(hour from v_local)>=19 THEN RETURN NULL; END IF;
 SELECT * INTO i FROM public.meta_whatsapp_instances WHERE id=p_instancia FOR UPDATE;
 IF NOT FOUND OR NOT i.ativo OR i.provider<>'meta' OR NOT i.recuperacao_ativa OR i.partner_client_id IS NOT NULL OR i.instancia_teste_aquecimento OR i.aquecimento_qualidade_permitido=false OR i.saude_status<>'CONNECTED' OR i.saude_quality NOT IN ('YELLOW','RED') THEN RETURN NULL; END IF;
 IF coalesce(i.saude_ban_info::text,'null') NOT IN ('null','{}','[]') OR coalesce(i.pausa_automatica_motivo,'') ~* '(131031|131042|payment|pagamento|billing|ban|blocked|account.lock|restri.*envio)' THEN RETURN NULL; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.meta_recuperacao_cadastral_config c WHERE c.user_id=i.user_id AND c.ativo) OR i.recuperacao_proximo_envio_em>now() THEN RETURN NULL; END IF;
 SELECT count(*) INTO v_n FROM public.meta_recuperacao_log WHERE instancia_id=i.id AND dia=v_dia AND status IN ('reservado','enviado');
 IF v_n>=least(20,greatest(1,coalesce(i.recuperacao_msgs_meta_dia,10))) THEN RETURN NULL; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.meta_templates_instancia t JOIN public.meta_templates_mestre m ON m.id=t.template_mestre_id WHERE t.instancia_id=i.id AND t.status='APPROVED' AND m.criado_por=i.user_id AND m.nome='fins_de_atualizacao_cadastral' AND m.categoria='UTILITY' AND NOT coalesce(m.reclassificado_marketing,false)) THEN RETURN NULL; END IF;
 SELECT * INTO d FROM public.meta_recuperacao_cadastral_destinos WHERE user_id=i.user_id AND telefone_sufixo=p_sufixo FOR UPDATE;
 IF NOT FOUND OR d.autorizado_em IS NULL OR d.bloqueado_em IS NOT NULL OR (d.fonte<>'uazapi' AND d.consumido_em IS NOT NULL) OR length(trim(d.nome_empresa))<3 THEN RETURN NULL; END IF;
 IF EXISTS(SELECT 1 FROM public.meta_destinatario_supressao s WHERE s.telefone_sufixo=p_sufixo) THEN RETURN NULL; END IF;
 IF d.lead_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.google_maps_leads l WHERE l.id=d.lead_id AND l.user_id=i.user_id AND l.tem_whatsapp=true) THEN RETURN NULL; END IF;
 IF d.fonte='uazapi' THEN
   IF NOT EXISTS(SELECT 1 FROM public.meta_whatsapp_instances x WHERE x.id=d.destino_instancia_id AND x.ativo AND x.provider='uazapi' AND x.folder_padrao_id='4f7a52c0-9c86-4b80-8867-4ade7a6df441') THEN RETURN NULL; END IF;
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
 IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Acesso interno obrigatório'; END IF;
 UPDATE public.meta_recuperacao_log l SET agradecimento_claim_em=now(),resposta_tipo='confirmacao',resposta_em=coalesce(resposta_em,now()) WHERE l.id=p_log AND l.cadastral AND l.status='enviado' AND l.agradecimento_claim_em IS NULL AND l.resposta_tipo IS DISTINCT FROM 'saida' AND l.resposta_tipo IS DISTINCT FROM 'negativa' AND NOT EXISTS(SELECT 1 FROM public.meta_destinatario_supressao s WHERE s.telefone_sufixo=l.telefone_sufixo) RETURNING l.id INTO v_id;
 RETURN v_id IS NOT NULL;
END $$;
REVOKE ALL ON FUNCTION public.claim_agradecimento_cadastral(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_agradecimento_cadastral(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.blacklist_saida_cadastral(p_instancia uuid,p_telefone text,p_texto text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_suf text:=right(regexp_replace(p_telefone,'\D','','g'),8); i public.meta_whatsapp_instances%ROWTYPE;
BEGIN
 IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Acesso interno obrigatório'; END IF;
 SELECT * INTO i FROM public.meta_whatsapp_instances WHERE id=p_instancia;
 IF NOT FOUND OR length(v_suf)<>8 THEN RAISE EXCEPTION 'Destinatário inválido'; END IF;
 INSERT INTO public.meta_destinatario_supressao(telefone_sufixo,telefone,motivo,categoria,instancia_id,origem_user_id,origem_texto,caixa_id,caixa_nome) VALUES(v_suf,p_telefone,'blacklist: SAIR no fluxo cadastral','blacklist',i.id,i.user_id,left(p_texto,300),'4f7a52c0-9c86-4b80-8867-4ade7a6df441','AQUECIMENTO') ON CONFLICT(telefone_sufixo) DO UPDATE SET categoria='blacklist',motivo=CASE WHEN meta_destinatario_supressao.categoria='blacklist' THEN meta_destinatario_supressao.motivo ELSE excluded.motivo END,atualizado_em=now();
 UPDATE public.meta_recuperacao_cadastral_destinos SET bloqueado_em=now() WHERE telefone_sufixo=v_suf;
 UPDATE public.meta_recuperacao_log SET resposta_tipo='saida',resposta_em=now() WHERE cadastral AND telefone_sufixo=v_suf;
 DELETE FROM public.meta_aquecimento_auto_respondedores WHERE right(regexp_replace(coalesce(telefone_normalizado,telefone,''),'\D','','g'),8)=v_suf;
 UPDATE public.google_maps_auto_resposta_candidatos SET status='descartado',atualizado_em=now() WHERE right(regexp_replace(coalesce(telefone_normalizado,telefone,''),'\D','','g'),8)=v_suf;
END $$;
REVOKE ALL ON FUNCTION public.blacklist_saida_cadastral(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.blacklist_saida_cadastral(uuid,text,text) TO service_role;
CREATE OR REPLACE FUNCTION public.claim_reposicao_cadastral(p_owner uuid,p_token uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;
BEGIN
 IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Acesso interno obrigatório'; END IF;
 IF EXISTS(SELECT 1 FROM public.meta_recuperacao_cadastral_destinos d WHERE d.user_id=p_owner AND d.fonte<>'uazapi' AND d.consumido_em IS NULL AND d.bloqueado_em IS NULL AND d.autorizado_em IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.meta_destinatario_supressao s WHERE s.telefone_sufixo=d.telefone_sufixo)) THEN RETURN false; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.meta_recuperacao_cadastral_destinos d WHERE d.user_id=p_owner AND d.fonte<>'uazapi' AND d.consumido_em IS NOT NULL) THEN RETURN false; END IF;
 UPDATE public.meta_recuperacao_cadastral_config SET reposicao_token=p_token,reposicao_em=now(),reposicao_resultado=NULL WHERE user_id=p_owner AND ativo AND (reposicao_em IS NULL OR reposicao_em<now()-interval '24 hours') RETURNING user_id INTO v_id;
 RETURN v_id IS NOT NULL;
END $$;
REVOKE ALL ON FUNCTION public.claim_reposicao_cadastral(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_reposicao_cadastral(uuid,uuid) TO service_role;