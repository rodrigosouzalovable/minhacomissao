CREATE OR REPLACE FUNCTION public.blacklist_saida_novo_mundo(p_instancia uuid,p_telefone text,p_texto text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_suffix text:=right(regexp_replace(p_telefone,'\D','','g'),8); v_owner uuid;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Acesso interno obrigatório'; END IF;
 SELECT user_id INTO v_owner FROM public.meta_whatsapp_instances WHERE id=p_instancia;
 IF v_owner IS NULL OR length(v_suffix)<>8 OR NOT EXISTS(SELECT 1 FROM public.meta_recuperacao_log WHERE instancia_id=p_instancia AND telefone_sufixo=v_suffix AND fonte='novo_mundo') THEN RAISE EXCEPTION 'Contato não pertence ao fluxo Novo Mundo'; END IF;
 INSERT INTO public.meta_destinatario_supressao(telefone_sufixo,telefone,motivo,categoria,instancia_id,origem_user_id,origem_texto,caixa_id,caixa_nome) VALUES(v_suffix,p_telefone,'blacklist: SAIR na base Novo Mundo','blacklist',p_instancia,v_owner,left(p_texto,300),NULL,'PADRÃO') ON CONFLICT(telefone_sufixo) DO UPDATE SET categoria='blacklist',motivo=CASE WHEN meta_destinatario_supressao.categoria='blacklist' THEN meta_destinatario_supressao.motivo ELSE excluded.motivo END,atualizado_em=now();
 UPDATE public.meta_recuperacao_log SET resposta_tipo='saida',resposta_em=now() WHERE cadastral AND telefone_sufixo=v_suffix;
 UPDATE public.meta_novo_mundo_contatos SET estado='bloqueado' WHERE telefone_sufixo=v_suffix AND estado='pendente';
END $$;
REVOKE ALL ON FUNCTION public.blacklist_saida_novo_mundo(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.blacklist_saida_novo_mundo(uuid,text,text) TO service_role;
CREATE OR REPLACE FUNCTION public.nm_reservation_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE i public.meta_whatsapp_instances%ROWTYPE;
BEGIN
 IF NEW.fonte IS DISTINCT FROM 'novo_mundo' THEN RETURN NEW; END IF;
 SELECT * INTO i FROM public.meta_whatsapp_instances WHERE id=NEW.instancia_id;
 IF i.quarentena_ate>now() OR coalesce(i.saude_status,'')<>'CONNECTED' OR NOT EXISTS(SELECT 1 FROM public.meta_novo_mundo_config WHERE user_id=i.user_id AND ativo) OR NOT EXISTS(SELECT 1 FROM public.meta_recuperacao_cadastral_config WHERE user_id=i.user_id AND ativo AND custo_autorizado_em IS NOT NULL) THEN RAISE EXCEPTION 'Remetente em quarentena ou recuperação não autorizada'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER nm_reservation_guard BEFORE INSERT ON public.meta_recuperacao_log FOR EACH ROW EXECUTE FUNCTION public.nm_reservation_guard();
CREATE INDEX nm_log_suffix ON public.meta_recuperacao_log(telefone_sufixo) WHERE cadastral;