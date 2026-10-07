CREATE OR REPLACE FUNCTION public.blacklist_saida_cadastral(p_instancia uuid,p_telefone text,p_texto text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_suf text:=right(regexp_replace(p_telefone,'\D','','g'),8); i public.meta_whatsapp_instances%ROWTYPE;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Acesso interno obrigatório'; END IF;
 SELECT * INTO i FROM public.meta_whatsapp_instances WHERE id=p_instancia;
 IF NOT FOUND OR length(v_suf)<>8 THEN RAISE EXCEPTION 'Destinatário inválido'; END IF;
 INSERT INTO public.meta_destinatario_supressao(telefone_sufixo,telefone,motivo,categoria,instancia_id,origem_user_id,origem_texto,caixa_id,caixa_nome) VALUES(v_suf,p_telefone,'blacklist: SAIR no fluxo cadastral','blacklist',i.id,i.user_id,left(p_texto,300),'4f7a52c0-9c86-4b80-8867-4ade7a6df441','AQUECIMENTO') ON CONFLICT(telefone_sufixo) DO UPDATE SET categoria='blacklist',motivo=CASE WHEN meta_destinatario_supressao.categoria='blacklist' THEN meta_destinatario_supressao.motivo ELSE excluded.motivo END,atualizado_em=now();
 UPDATE public.meta_recuperacao_cadastral_destinos SET bloqueado_em=now() WHERE telefone_sufixo=v_suf;
 UPDATE public.meta_recuperacao_log SET resposta_tipo='saida',resposta_em=now() WHERE cadastral AND telefone_sufixo=v_suf;
 DELETE FROM public.meta_aquecimento_auto_respondedores WHERE right(regexp_replace(coalesce(telefone_normalizado,telefone,''),'\D','','g'),8)=v_suf;
 DELETE FROM public.google_maps_auto_resposta_candidatos WHERE right(regexp_replace(coalesce(telefone_normalizado,telefone,''),'\D','','g'),8)=v_suf;
END $$;
REVOKE ALL ON FUNCTION public.blacklist_saida_cadastral(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.blacklist_saida_cadastral(uuid,text,text) TO service_role;
CREATE OR REPLACE FUNCTION public.preparar_conversa_cadastral(p_log uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l public.meta_recuperacao_log%ROWTYPE; i public.meta_whatsapp_instances%ROWTYPE; c public.meta_whatsapp_contatos%ROWTYPE; v_id uuid;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Acesso interno obrigatório'; END IF;
 SELECT * INTO l FROM public.meta_recuperacao_log WHERE id=p_log AND cadastral AND status='reservado' FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF EXISTS(SELECT 1 FROM public.meta_destinatario_supressao s WHERE s.telefone_sufixo=l.telefone_sufixo) THEN RETURN NULL; END IF;
 SELECT * INTO i FROM public.meta_whatsapp_instances WHERE id=l.instancia_id;
 SELECT * INTO c FROM public.meta_whatsapp_contatos WHERE instancia_id=i.id AND right(regexp_replace(telefone,'\D','','g'),8)=l.telefone_sufixo ORDER BY atualizado_em DESC LIMIT 1 FOR UPDATE;
 IF FOUND THEN
   IF c.folder_id IS DISTINCT FROM '4f7a52c0-9c86-4b80-8867-4ade7a6df441'::uuid THEN RETURN NULL; END IF;
   v_id:=c.id;
   UPDATE public.meta_whatsapp_contatos SET origem_aquecimento='recuperacao_cadastral' WHERE id=v_id;
 ELSE
   INSERT INTO public.meta_whatsapp_contatos(user_id,instancia_id,telefone,nome,telefone_visivel,folder_id,origem_aquecimento) VALUES(i.user_id,i.id,l.destino_telefone,l.nome_empresa,true,'4f7a52c0-9c86-4b80-8867-4ade7a6df441','recuperacao_cadastral') RETURNING id INTO v_id;
 END IF;
 UPDATE public.meta_recuperacao_log SET contato_id=v_id WHERE id=l.id;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.preparar_conversa_cadastral(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.preparar_conversa_cadastral(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.preservar_blacklist_cadastral()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF OLD.categoria='blacklist' AND EXISTS(SELECT 1 FROM public.meta_recuperacao_log l WHERE l.cadastral AND l.telefone_sufixo=OLD.telefone_sufixo AND l.resposta_tipo='saida') THEN
   NEW.categoria:=OLD.categoria; NEW.motivo:=OLD.motivo;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER preservar_optout_cadastral BEFORE UPDATE ON public.meta_destinatario_supressao FOR EACH ROW EXECUTE FUNCTION public.preservar_blacklist_cadastral();
CREATE INDEX IF NOT EXISTS cadastral_contato_sufixo ON public.meta_whatsapp_contatos(instancia_id,(right(regexp_replace(telefone,'\D','','g'),8)));
CREATE INDEX IF NOT EXISTS cadastral_lead_sufixo ON public.google_maps_leads(user_id,(right(regexp_replace(coalesce(telefone_internacional,telefone,''),'\D','','g'),8)));
CREATE INDEX IF NOT EXISTS cadastral_log_optout ON public.meta_recuperacao_log(telefone_sufixo) WHERE cadastral AND resposta_tipo='saida';