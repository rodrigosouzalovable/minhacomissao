CREATE TABLE public.meta_novo_mundo_config (user_id uuid PRIMARY KEY, ativo boolean NOT NULL DEFAULT false, atualizado_em timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.meta_novo_mundo_config TO authenticated;
GRANT ALL ON public.meta_novo_mundo_config TO service_role;
ALTER TABLE public.meta_novo_mundo_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY nm_config_owner ON public.meta_novo_mundo_config FOR SELECT TO authenticated USING (user_id=auth.uid() AND public.has_role(auth.uid(),'admin'));
CREATE TABLE public.meta_novo_mundo_lotes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, arquivo text NOT NULL, recebido integer NOT NULL, adicionados integer NOT NULL, descartados integer NOT NULL, resumo jsonb NOT NULL DEFAULT '{}', autorizado_em timestamptz NOT NULL DEFAULT now(), autorizacao text NOT NULL, criado_em timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.meta_novo_mundo_lotes TO authenticated;
GRANT ALL ON public.meta_novo_mundo_lotes TO service_role;
ALTER TABLE public.meta_novo_mundo_lotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY nm_lotes_owner ON public.meta_novo_mundo_lotes FOR SELECT TO authenticated USING (user_id=auth.uid() AND public.has_role(auth.uid(),'admin'));
CREATE INDEX nm_lotes_owner_created ON public.meta_novo_mundo_lotes(user_id,criado_em DESC);
CREATE TABLE public.meta_novo_mundo_contatos (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, lote_id uuid NOT NULL REFERENCES public.meta_novo_mundo_lotes(id), telefone text NOT NULL, telefone_sufixo text NOT NULL CHECK (telefone_sufixo ~ '^[0-9]{8}$'), var1 text NOT NULL CHECK(length(var1) BETWEEN 1 AND 200), var2 text NOT NULL CHECK(length(var2) BETWEEN 1 AND 200), estado text NOT NULL DEFAULT 'pendente' CHECK(estado IN ('pendente','reservado','enviado','falha','bloqueado')), log_id uuid REFERENCES public.meta_recuperacao_log(id), criado_em timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,telefone_sufixo));
GRANT SELECT ON public.meta_novo_mundo_contatos TO authenticated;
GRANT ALL ON public.meta_novo_mundo_contatos TO service_role;
ALTER TABLE public.meta_novo_mundo_contatos ENABLE ROW LEVEL SECURITY;
CREATE POLICY nm_contatos_owner ON public.meta_novo_mundo_contatos FOR SELECT TO authenticated USING (user_id=auth.uid() AND public.has_role(auth.uid(),'admin'));
CREATE INDEX nm_contatos_fila ON public.meta_novo_mundo_contatos(user_id,estado,criado_em,id);
CREATE INDEX nm_contatos_suffix ON public.meta_novo_mundo_contatos(telefone_sufixo);
CREATE INDEX nm_contatos_log ON public.meta_novo_mundo_contatos(log_id) WHERE log_id IS NOT NULL;
ALTER TABLE public.meta_recuperacao_log ADD COLUMN custo_reservado_brl numeric;
CREATE INDEX nm_recuperacao_owner_cost ON public.meta_recuperacao_log(dia,instancia_id) WHERE cadastral;
CREATE OR REPLACE FUNCTION public.importar_contatos_novo_mundo(p_arquivo text,p_rows jsonb,p_resumo jsonb,p_autorizado boolean,p_simulacao boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_owner uuid:=auth.uid(); v_lote uuid; v_row jsonb; v_suffix text; v_count integer:=0; v_bloq integer:=0; v_usado integer:=0; v_exist integer:=0; v_pending integer; v_n integer; v_res jsonb;
BEGIN
 IF v_owner IS NULL OR NOT public.has_role(v_owner,'admin') OR v_owner<>'ee649720-b8ce-47a2-859e-100a3a9ae6bb'::uuid THEN RAISE EXCEPTION 'Apenas o administrador proprietário da recuperação pode importar esta base'; END IF;
 IF p_autorizado IS DISTINCT FROM true OR p_arquivo IS NULL OR length(p_arquivo) NOT BETWEEN 1 AND 255 OR jsonb_typeof(p_rows) IS DISTINCT FROM 'array' OR jsonb_array_length(p_rows) NOT BETWEEN 1 AND 5000 OR jsonb_typeof(p_resumo) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Arquivo, autorização ou contatos inválidos'; END IF;
 v_n:=(p_resumo->>'total')::integer;
 IF v_n NOT BETWEEN 1 AND 5000 OR v_n<jsonb_array_length(p_rows) THEN RAISE EXCEPTION 'Limite de 5.000 linhas de contatos por importação'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('nm-import:'||v_owner,0));
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_rows) r WHERE (r->>'telefone') IS NULL OR (r->>'telefone') !~ '^55[0-9]{10,11}$' OR substring(r->>'telefone',3,2) NOT IN ('11','12','13','14','15','16','17','18','19','21','22','24','27','28','31','32','33','34','35','37','38','41','42','43','44','45','46','47','48','49','51','53','54','55','61','62','63','64','65','66','67','68','69','71','73','74','75','77','79','81','82','83','84','85','86','87','88','89','91','92','93','94','95','96','97','98','99') OR substring(r->>'telefone',5,1) NOT BETWEEN '2' AND '9' OR coalesce(length(trim(r->>'var1')),0)=0 OR coalesce(length(trim(r->>'var2')),0)=0 OR length(r->>'var1')>200 OR length(r->>'var2')>200 OR (r->>'var1') ~ E'[\r\n]' OR (r->>'var2') ~ E'[\r\n]') THEN RAISE EXCEPTION 'Telefone ou variáveis inválidos'; END IF;
 IF (SELECT count(DISTINCT right(r->>'telefone',8)) FROM jsonb_array_elements(p_rows) r)<>jsonb_array_length(p_rows) THEN RAISE EXCEPTION 'Telefones repetidos: revise os sufixos e variáveis'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_rows) r JOIN public.meta_novo_mundo_contatos c ON c.user_id=v_owner AND c.telefone_sufixo=right(r->>'telefone',8) WHERE c.estado='pendente' AND (c.var1 IS DISTINCT FROM r->>'var1' OR c.var2 IS DISTINCT FROM r->>'var2')) THEN RAISE EXCEPTION 'Há telefone pendente com variáveis diferentes. Revise o arquivo antes de importar'; END IF;
 SELECT count(*) INTO v_pending FROM public.meta_novo_mundo_contatos c WHERE c.user_id=v_owner AND c.estado IN ('pendente','reservado') AND NOT EXISTS(SELECT 1 FROM public.meta_destinatario_supressao s WHERE s.telefone_sufixo=c.telefone_sufixo);
 FOR v_row IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
  v_suffix:=right(v_row->>'telefone',8);
  IF EXISTS(SELECT 1 FROM public.meta_destinatario_supressao s WHERE s.telefone_sufixo=v_suffix) THEN v_bloq:=v_bloq+1;
  ELSIF EXISTS(SELECT 1 FROM public.meta_maps_aquecimento_consumidos u WHERE u.telefone_sufixo=v_suffix) OR EXISTS(SELECT 1 FROM public.meta_recuperacao_log l WHERE l.cadastral AND l.telefone_sufixo=v_suffix) THEN v_usado:=v_usado+1;
  ELSIF EXISTS(SELECT 1 FROM public.meta_novo_mundo_contatos c WHERE c.user_id=v_owner AND c.telefone_sufixo=v_suffix) THEN v_exist:=v_exist+1;
  ELSE v_count:=v_count+1; END IF;
 END LOOP;
 IF v_pending+v_count>5000 THEN RAISE EXCEPTION 'Estoque comporta apenas mais % contatos; este lote adicionaria %',5000-v_pending,v_count; END IF;
 v_res:=jsonb_build_object('total',v_n,'adicionados',v_count,'bloqueados',v_bloq,'ja_utilizados',v_usado,'ja_pendentes',v_exist,'invalidos',coalesce((p_resumo->>'invalidos')::integer,0),'duplicados',coalesce((p_resumo->>'duplicados')::integer,0),'capacidade_livre',5000-v_pending-v_count);
 IF p_simulacao THEN RETURN v_res; END IF;
 IF v_count=0 THEN RAISE EXCEPTION 'Nenhum contato novo elegível para adicionar'; END IF;
 INSERT INTO public.meta_novo_mundo_lotes(user_id,arquivo,recebido,adicionados,descartados,resumo,autorizacao) VALUES(v_owner,p_arquivo,v_n,v_count,v_n-v_count,v_res,'Proprietário declarou autorização WhatsApp dos contatos Novo Mundo deste lote') RETURNING id INTO v_lote;
 INSERT INTO public.meta_novo_mundo_contatos(user_id,lote_id,telefone,telefone_sufixo,var1,var2)
 SELECT v_owner,v_lote,r->>'telefone',right(r->>'telefone',8),r->>'var1',r->>'var2' FROM jsonb_array_elements(p_rows) r WHERE NOT EXISTS(SELECT 1 FROM public.meta_destinatario_supressao s WHERE s.telefone_sufixo=right(r->>'telefone',8)) AND NOT EXISTS(SELECT 1 FROM public.meta_maps_aquecimento_consumidos u WHERE u.telefone_sufixo=right(r->>'telefone',8)) AND NOT EXISTS(SELECT 1 FROM public.meta_recuperacao_log l WHERE l.cadastral AND l.telefone_sufixo=right(r->>'telefone',8)) AND NOT EXISTS(SELECT 1 FROM public.meta_novo_mundo_contatos c WHERE c.user_id=v_owner AND c.telefone_sufixo=right(r->>'telefone',8));
 GET DIAGNOSTICS v_n=ROW_COUNT;
 IF v_n<>v_count THEN RAISE EXCEPTION 'A elegibilidade mudou durante a conferência. Atualize e tente importar novamente'; END IF;
 INSERT INTO public.meta_novo_mundo_config(user_id) VALUES(v_owner) ON CONFLICT DO NOTHING;
 RETURN v_res||jsonb_build_object('lote_id',v_lote);
END $$;
REVOKE ALL ON FUNCTION public.importar_contatos_novo_mundo(text,jsonb,jsonb,boolean,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.importar_contatos_novo_mundo(text,jsonb,jsonb,boolean,boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.ativar_base_novo_mundo(p_ativo boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') OR auth.uid()<>'ee649720-b8ce-47a2-859e-100a3a9ae6bb'::uuid OR p_ativo IS NULL THEN RAISE EXCEPTION 'Apenas o administrador proprietário pode ativar'; END IF;
 IF p_ativo AND NOT EXISTS(SELECT 1 FROM public.meta_recuperacao_cadastral_config c WHERE c.user_id=auth.uid() AND c.ativo AND c.custo_autorizado_em IS NOT NULL AND c.custo_limite_diario_brl>0) THEN RAISE EXCEPTION 'Recuperação e consentimento de custo precisam estar ativos'; END IF;
 IF p_ativo AND NOT EXISTS(SELECT 1 FROM public.meta_novo_mundo_contatos c WHERE c.user_id=auth.uid() AND c.estado='pendente' AND NOT EXISTS(SELECT 1 FROM public.meta_destinatario_supressao s WHERE s.telefone_sufixo=c.telefone_sufixo)) THEN RAISE EXCEPTION 'Importe contatos elegíveis antes de ativar'; END IF;
 INSERT INTO public.meta_novo_mundo_config(user_id,ativo) VALUES(auth.uid(),p_ativo) ON CONFLICT(user_id) DO UPDATE SET ativo=excluded.ativo,atualizado_em=now();
END $$;
REVOKE ALL ON FUNCTION public.ativar_base_novo_mundo(boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ativar_base_novo_mundo(boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.limitar_orcamento_recuperacao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_owner uuid; v_limite numeric; v_tarifa numeric; v_uso numeric;
BEGIN
 IF NOT NEW.cadastral THEN RETURN NEW; END IF;
 SELECT user_id INTO v_owner FROM public.meta_whatsapp_instances WHERE id=NEW.instancia_id;
 PERFORM pg_advisory_xact_lock(hashtextextended('recuperacao-budget:'||v_owner,0));
 SELECT least(20.30,c.custo_limite_diario_brl) INTO v_limite FROM public.meta_recuperacao_cadastral_config c WHERE c.user_id=v_owner AND c.ativo AND c.custo_autorizado_em IS NOT NULL;
 SELECT valor_brl INTO v_tarifa FROM public.meta_tarifas_mensagem WHERE pais='BR' AND categoria='UTILITY' AND vigencia_inicio<=NEW.dia ORDER BY vigencia_inicio DESC LIMIT 1;
 IF v_limite IS NULL OR v_tarifa IS NULL OR v_tarifa<=0 THEN RAISE EXCEPTION 'Orçamento ou tarifa vigente não confirmados'; END IF;
 SELECT coalesce(sum(coalesce(l.custo_reservado_brl,v_tarifa)),0) INTO v_uso FROM public.meta_recuperacao_log l JOIN public.meta_whatsapp_instances i ON i.id=l.instancia_id WHERE i.user_id=v_owner AND l.dia=NEW.dia;
 IF v_uso+v_tarifa>v_limite THEN RAISE EXCEPTION 'Teto diário compartilhado da recuperação atingido'; END IF;
 NEW.custo_reservado_brl:=v_tarifa;
 RETURN NEW;
END $$;
CREATE TRIGGER limitar_orcamento_recuperacao BEFORE INSERT ON public.meta_recuperacao_log FOR EACH ROW EXECUTE FUNCTION public.limitar_orcamento_recuperacao();
CREATE OR REPLACE FUNCTION public.reservar_novo_mundo(p_instancia uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE i public.meta_whatsapp_instances%ROWTYPE; c public.meta_novo_mundo_contatos%ROWTYPE; v_id uuid; v_claim text; v_n integer; v_local timestamp:=now() AT TIME ZONE 'America/Sao_Paulo'; v_dia date:=v_local::date;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Acesso interno obrigatório'; END IF;
 IF extract(dow FROM v_local)=0 OR extract(hour FROM v_local)<8 OR extract(hour FROM v_local)>=19 THEN RETURN NULL; END IF;
 SELECT * INTO i FROM public.meta_whatsapp_instances WHERE id=p_instancia FOR UPDATE;
 IF NOT FOUND OR i.user_id<>'ee649720-b8ce-47a2-859e-100a3a9ae6bb'::uuid OR i.ativo IS DISTINCT FROM true OR i.provider IS DISTINCT FROM 'meta' OR i.recuperacao_ativa IS DISTINCT FROM true OR i.saude_status IS DISTINCT FROM 'CONNECTED' OR coalesce(i.saude_quality,'') NOT IN ('YELLOW','RED') OR i.partner_client_id IS NOT NULL OR i.instancia_teste_aquecimento OR i.aquecimento_qualidade_permitido=false OR i.recuperacao_proximo_envio_em>now() THEN RETURN NULL; END IF;
 IF coalesce(i.saude_ban_info::text,'null') NOT IN ('null','{}','[]') OR coalesce(i.pausa_automatica_motivo,'') ~* '(131031|131042|payment|pagamento|billing|ban|blocked|account.lock|restri.*envio)' THEN RETURN NULL; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.meta_novo_mundo_config n WHERE n.user_id=i.user_id AND n.ativo) THEN RETURN NULL; END IF;
 SELECT count(*) INTO v_n FROM public.meta_recuperacao_log WHERE instancia_id=i.id AND dia=v_dia;
 IF v_n>=least(20,greatest(1,coalesce(i.recuperacao_msgs_meta_dia,10))) THEN RETURN NULL; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.meta_templates_instancia t JOIN public.meta_templates_mestre m ON m.id=t.template_mestre_id WHERE t.instancia_id=i.id AND t.status='APPROVED' AND m.criado_por=i.user_id AND m.nome='fins_de_atualizacao_cadastral' AND m.categoria='UTILITY' AND NOT coalesce(m.reclassificado_marketing,false)) THEN RETURN NULL; END IF;
 FOR c IN SELECT * FROM public.meta_novo_mundo_contatos q WHERE q.user_id=i.user_id AND q.estado='pendente' ORDER BY q.criado_em,q.id LIMIT 30 FOR UPDATE SKIP LOCKED LOOP
  IF EXISTS(SELECT 1 FROM public.meta_destinatario_supressao s WHERE s.telefone_sufixo=c.telefone_sufixo) OR EXISTS(SELECT 1 FROM public.meta_maps_aquecimento_consumidos u WHERE u.telefone_sufixo=c.telefone_sufixo) OR EXISTS(SELECT 1 FROM public.meta_recuperacao_log l WHERE l.cadastral AND l.telefone_sufixo=c.telefone_sufixo) THEN UPDATE public.meta_novo_mundo_contatos SET estado='bloqueado' WHERE id=c.id; CONTINUE; END IF;
  IF c.telefone_sufixo=right(regexp_replace(coalesce(i.display_phone,''),'\D','','g'),8) OR EXISTS(SELECT 1 FROM public.meta_whatsapp_contatos ct WHERE ct.instancia_id=i.id AND right(regexp_replace(ct.telefone,'\D','','g'),8)=c.telefone_sufixo AND ct.folder_id IS NOT NULL) THEN CONTINUE; END IF;
  INSERT INTO public.meta_maps_aquecimento_consumidos(telefone_sufixo,origem,instancia_id) VALUES(c.telefone_sufixo,'novo_mundo',i.id) ON CONFLICT DO NOTHING RETURNING telefone_sufixo INTO v_claim;
  IF v_claim IS NULL THEN CONTINUE; END IF;
  INSERT INTO public.meta_recuperacao_log(instancia_id,destino_telefone,tipo,status,dia,cadastral,fonte,nome_empresa,telefone_sufixo,variaveis) VALUES(i.id,c.telefone,'recuperacao:fins_de_atualizacao_cadastral','reservado',v_dia,true,'novo_mundo',c.var2,c.telefone_sufixo,jsonb_build_array(c.var1,c.var2)) RETURNING id INTO v_id;
  UPDATE public.meta_novo_mundo_contatos SET estado='reservado',log_id=v_id WHERE id=c.id;
  UPDATE public.meta_whatsapp_instances SET recuperacao_proximo_envio_em=now()+make_interval(secs=>1200+floor(random()*1201)::integer) WHERE id=i.id;
  RETURN v_id;
 END LOOP;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.reservar_novo_mundo(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reservar_novo_mundo(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.preparar_conversa_novo_mundo(p_log uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l public.meta_recuperacao_log%ROWTYPE; i public.meta_whatsapp_instances%ROWTYPE; c public.meta_whatsapp_contatos%ROWTYPE; v_id uuid;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Acesso interno obrigatório'; END IF;
 SELECT * INTO l FROM public.meta_recuperacao_log WHERE id=p_log AND cadastral AND fonte='novo_mundo' AND status='reservado' FOR UPDATE;
 IF NOT FOUND OR EXISTS(SELECT 1 FROM public.meta_destinatario_supressao s WHERE s.telefone_sufixo=l.telefone_sufixo) THEN RETURN NULL; END IF;
 SELECT * INTO i FROM public.meta_whatsapp_instances WHERE id=l.instancia_id;
 SELECT * INTO c FROM public.meta_whatsapp_contatos ct WHERE ct.instancia_id=i.id AND right(regexp_replace(ct.telefone,'\D','','g'),8)=l.telefone_sufixo ORDER BY ct.atualizado_em DESC LIMIT 1 FOR UPDATE;
 IF FOUND THEN
  IF c.folder_id IS NOT NULL THEN RETURN NULL; END IF;
  v_id:=c.id;
  UPDATE public.meta_whatsapp_contatos SET origem_aquecimento='recuperacao_novo_mundo',credor='NOVO MUNDO' WHERE id=v_id;
 ELSE
  INSERT INTO public.meta_whatsapp_contatos(user_id,instancia_id,telefone,nome,telefone_visivel,folder_id,origem_aquecimento,credor) VALUES(i.user_id,i.id,l.destino_telefone,l.nome_empresa,true,NULL,'recuperacao_novo_mundo','NOVO MUNDO') RETURNING id INTO v_id;
 END IF;
 UPDATE public.meta_recuperacao_log SET contato_id=v_id WHERE id=l.id;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.preparar_conversa_novo_mundo(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.preparar_conversa_novo_mundo(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.nm_sync_log()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.fonte='novo_mundo' THEN UPDATE public.meta_novo_mundo_contatos SET estado=CASE WHEN NEW.status='enviado' THEN 'enviado' WHEN NEW.status='falha' THEN 'falha' ELSE 'reservado' END WHERE log_id=NEW.id; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER nm_sync_log AFTER UPDATE OF status ON public.meta_recuperacao_log FOR EACH ROW EXECUTE FUNCTION public.nm_sync_log();
CREATE OR REPLACE FUNCTION public.nm_sync_supressao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE public.meta_novo_mundo_contatos SET estado='bloqueado' WHERE telefone_sufixo=NEW.telefone_sufixo AND estado='pendente';
 RETURN NEW;
END $$;
CREATE TRIGGER nm_sync_supressao AFTER INSERT OR UPDATE ON public.meta_destinatario_supressao FOR EACH ROW EXECUTE FUNCTION public.nm_sync_supressao();
CREATE OR REPLACE FUNCTION public.resumo_base_novo_mundo()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_owner uuid:=auth.uid(); v_res jsonb; v_tarifa numeric; v_custo numeric;
BEGIN
 IF v_owner IS NULL OR NOT public.has_role(v_owner,'admin') THEN RAISE EXCEPTION 'Acesso não autorizado'; END IF;
 SELECT valor_brl INTO v_tarifa FROM public.meta_tarifas_mensagem WHERE pais='BR' AND categoria='UTILITY' AND vigencia_inicio<=(now() AT TIME ZONE 'America/Sao_Paulo')::date ORDER BY vigencia_inicio DESC LIMIT 1;
 SELECT coalesce(sum(coalesce(l.custo_reservado_brl,v_tarifa)),0) INTO v_custo FROM public.meta_recuperacao_log l JOIN public.meta_whatsapp_instances i ON i.id=l.instancia_id WHERE i.user_id=v_owner AND l.dia=(now() AT TIME ZONE 'America/Sao_Paulo')::date;
 SELECT jsonb_build_object('disponiveis',count(*) FILTER(WHERE c.estado='pendente' AND s.telefone_sufixo IS NULL),'reservados',count(*) FILTER(WHERE c.estado='reservado'),'aceitos',count(*) FILTER(WHERE l.status='enviado'),'entregues',count(*) FILTER(WHERE l.entregue_em IS NOT NULL),'respondidos',count(*) FILTER(WHERE l.resposta_em IS NOT NULL),'falhas',count(*) FILTER(WHERE c.estado='falha'),'bloqueados',count(*) FILTER(WHERE c.estado='bloqueado' OR (c.estado='pendente' AND s.telefone_sufixo IS NOT NULL))) INTO v_res FROM public.meta_novo_mundo_contatos c LEFT JOIN public.meta_recuperacao_log l ON l.id=c.log_id LEFT JOIN public.meta_destinatario_supressao s ON s.telefone_sufixo=c.telefone_sufixo WHERE c.user_id=v_owner;
 RETURN v_res||jsonb_build_object('ativo',coalesce((SELECT ativo FROM public.meta_novo_mundo_config WHERE user_id=v_owner),false),'custo_hoje',v_custo,'teto',coalesce((SELECT least(20.30,custo_limite_diario_brl) FROM public.meta_recuperacao_cadastral_config WHERE user_id=v_owner),20.30),'tarifa',v_tarifa,'descartados',coalesce((SELECT sum(descartados) FROM public.meta_novo_mundo_lotes WHERE user_id=v_owner),0),'ultimo_lote',(SELECT to_jsonb(x) FROM (SELECT arquivo,adicionados,descartados,criado_em FROM public.meta_novo_mundo_lotes WHERE user_id=v_owner ORDER BY criado_em DESC LIMIT 1) x));
END $$;
REVOKE ALL ON FUNCTION public.resumo_base_novo_mundo() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.resumo_base_novo_mundo() TO authenticated;