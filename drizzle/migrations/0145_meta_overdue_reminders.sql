CREATE TABLE public.meta_atrasados_config (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL DEFAULT auth.uid(), tenant_id uuid NOT NULL DEFAULT public.master_tenant_id(), ativo boolean NOT NULL DEFAULT false, template_nome text NOT NULL DEFAULT 'novo_lembrete_envio_boleto_variavel', idioma text NOT NULL DEFAULT 'pt_BR', variaveis_map jsonb NOT NULL DEFAULT '{"1":"nome","2":"credor","3":"vencimento"}'::jsonb, min_seg integer NOT NULL DEFAULT 3, max_seg integer NOT NULL DEFAULT 8, ativado_em timestamptz, lease_token uuid, lease_ate timestamptz, criado_em timestamptz NOT NULL DEFAULT now(), atualizado_em timestamptz NOT NULL DEFAULT now(), UNIQUE(owner_id,tenant_id));
GRANT SELECT ON public.meta_atrasados_config TO authenticated;
GRANT ALL ON public.meta_atrasados_config TO service_role;
ALTER TABLE public.meta_atrasados_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_admin ON public.meta_atrasados_config FOR SELECT TO authenticated USING(owner_id=auth.uid() AND public.has_role(auth.uid(),'admin') AND public.user_can_access_tenant(auth.uid(),tenant_id));
CREATE TABLE public.meta_atrasados_envios (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), config_id uuid NOT NULL REFERENCES public.meta_atrasados_config(id), pagamento_id uuid NOT NULL, acordo_id uuid NOT NULL, vencimento date NOT NULL, etapa integer NOT NULL, dia_envio date NOT NULL, user_id uuid NOT NULL, telefone text NOT NULL, instancia_id uuid, instancia_nome text, cliente_nome text, atendente_nome text, credor text, mensagem text, status text NOT NULL DEFAULT 'pendente', motivo text, wa_message_id text, atualizado_em timestamptz NOT NULL DEFAULT now(), criado_em timestamptz NOT NULL DEFAULT now(), UNIQUE(pagamento_id,vencimento,etapa));
GRANT SELECT ON public.meta_atrasados_envios TO authenticated;
GRANT ALL ON public.meta_atrasados_envios TO service_role;
ALTER TABLE public.meta_atrasados_envios ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_read ON public.meta_atrasados_envios FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.meta_atrasados_config c WHERE c.id=config_id AND c.owner_id=auth.uid() AND public.has_role(auth.uid(),'admin') AND public.user_can_access_tenant(auth.uid(),c.tenant_id)));
CREATE INDEX meta_atrasados_history ON public.meta_atrasados_envios(config_id,criado_em DESC);
CREATE INDEX meta_atrasados_daily ON public.meta_atrasados_envios(acordo_id,dia_envio,status);
CREATE OR REPLACE FUNCTION public.meta_atrasados_lock(p_config uuid,p_token uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN UPDATE public.meta_atrasados_config SET lease_token=p_token,lease_ate=now()+interval '110 seconds' WHERE id=p_config AND ativo AND (lease_ate IS NULL OR lease_ate<now()); RETURN FOUND; END; $$;
REVOKE ALL ON FUNCTION public.meta_atrasados_lock(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.meta_atrasados_lock(uuid,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.meta_atrasados_reservar(p_config uuid,p_pagamento uuid,p_etapa integer,p_vencimento date,p_dia date) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid; v_p public.pagamentos%ROWTYPE; v_a public.acordos%ROWTYPE; v_cfg public.meta_atrasados_config%ROWTYPE;
BEGIN
 SELECT * INTO v_cfg FROM public.meta_atrasados_config WHERE id=p_config AND ativo FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO v_p FROM public.pagamentos WHERE id=p_pagamento AND status='pendente' AND data_prevista=p_vencimento FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO v_a FROM public.acordos WHERE id=v_p.acordo_id AND status='ativo';
 IF NOT FOUND OR NOT public.user_can_access_tenant(v_a.user_id,v_cfg.tenant_id) THEN RETURN NULL; END IF;
 IF p_dia<>(now() AT TIME ZONE 'America/Sao_Paulo')::date OR (p_dia-p_vencimento) NOT BETWEEN 1 AND 10 OR p_etapa<>(CASE WHEN p_dia-p_vencimento>=7 THEN 7 WHEN p_dia-p_vencimento>=3 THEN 3 ELSE 1 END) THEN RETURN NULL; END IF;
 IF EXISTS(SELECT 1 FROM public.meta_atrasados_envios WHERE acordo_id=v_a.id AND dia_envio=p_dia AND status IN ('reservado','aceito','incerto')) THEN RETURN NULL; END IF;
 INSERT INTO public.meta_atrasados_envios(config_id,pagamento_id,acordo_id,vencimento,etapa,dia_envio,user_id,telefone,cliente_nome,status) VALUES(p_config,v_p.id,v_a.id,p_vencimento,p_etapa,p_dia,v_a.user_id,coalesce(v_a.cliente_telefone,''),v_a.cliente_nome,'reservado') ON CONFLICT(pagamento_id,vencimento,etapa) DO UPDATE SET status='reservado',dia_envio=p_dia,atualizado_em=now() WHERE meta_atrasados_envios.status='pendente' RETURNING id INTO v_id;
 RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION public.meta_atrasados_reservar(uuid,uuid,integer,date,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.meta_atrasados_reservar(uuid,uuid,integer,date,date) TO service_role;
CREATE OR REPLACE FUNCTION public.meta_atrasados_contato(p_instancia uuid,p_telefone text,p_user uuid,p_nome text,p_credor text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_inst public.meta_whatsapp_instances%ROWTYPE; v_cont public.meta_whatsapp_contatos%ROWTYPE; v_label uuid; v_folder uuid;
BEGIN
 SELECT * INTO v_inst FROM public.meta_whatsapp_instances WHERE id=p_instancia AND ativo AND saude_quality='GREEN' AND saude_status='CONNECTED' AND coalesce(provider,'meta')='meta' AND coalesce(estado_pool,'ativo')='ativo' AND NOT coalesce(pool_fora_manual,false);
 IF NOT FOUND THEN RAISE EXCEPTION 'Instância não está GREEN e disponível'; END IF;
 SELECT * INTO v_cont FROM public.meta_whatsapp_contatos WHERE instancia_id=p_instancia AND public.phone_suffix8(telefone)=public.phone_suffix8(p_telefone) ORDER BY atualizado_em DESC LIMIT 1 FOR UPDATE;
 v_folder:=CASE WHEN v_cont.id IS NOT NULL THEN v_cont.folder_id ELSE v_inst.folder_padrao_id END;
 IF NOT EXISTS(SELECT 1 FROM public.user_permissions WHERE user_id=p_user AND atende_inbox_meta=true) OR NOT public.user_can_access_tenant(p_user,v_inst.tenant_id) OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_user AND coalesce(ativo,true)) THEN RAISE EXCEPTION 'Funcionário não é elegível na caixa'; END IF;
 IF (v_folder IS NULL AND NOT EXISTS(SELECT 1 FROM public.meta_inbox_default_members WHERE user_id=p_user AND NOT coalesce(admin,false))) OR (v_folder IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.meta_inbox_folder_members WHERE user_id=p_user AND folder_id=v_folder AND NOT coalesce(admin,false))) THEN RAISE EXCEPTION 'Funcionário não pertence à caixa'; END IF;
 SELECT f.etiqueta_id INTO v_label FROM public.meta_atendimento_fila f JOIN public.meta_whatsapp_etiquetas e ON e.id=f.etiqueta_id WHERE f.user_id=p_user AND f.ativo AND f.tenant_id=v_inst.tenant_id AND e.user_id=v_inst.user_id AND e.ativa AND e.nome ILIKE 'Atendente:%' ORDER BY f.ordem LIMIT 1;
 IF v_label IS NULL THEN RAISE EXCEPTION 'Etiqueta do funcionário não disponível'; END IF;
 IF v_cont.id IS NOT NULL AND EXISTS(SELECT 1 FROM public.meta_whatsapp_contato_etiquetas ce JOIN public.meta_whatsapp_etiquetas e ON e.id=ce.etiqueta_id WHERE ce.contato_id=v_cont.id AND e.nome ILIKE 'Atendente:%' AND ce.etiqueta_id<>v_label) THEN RAISE EXCEPTION 'Conversa já atribuída a outro atendente; conferir antes de enviar'; END IF;
 IF v_cont.id IS NULL THEN INSERT INTO public.meta_whatsapp_contatos(instancia_id,user_id,tenant_id,telefone,nome,folder_id,credor) VALUES(p_instancia,v_inst.user_id,v_inst.tenant_id,p_telefone,p_nome,v_folder,p_credor) RETURNING * INTO v_cont; END IF;
 INSERT INTO public.meta_whatsapp_contato_etiquetas(contato_id,etiqueta_id,origem) VALUES(v_cont.id,v_label,'auto_atendente') ON CONFLICT DO NOTHING;
 IF NOT EXISTS(SELECT 1 FROM public.meta_whatsapp_contato_etiquetas WHERE contato_id=v_cont.id AND etiqueta_id=v_label) THEN RAISE EXCEPTION 'A etiqueta não pôde ser vinculada'; END IF;
 RETURN v_cont.id;
END; $$;
REVOKE ALL ON FUNCTION public.meta_atrasados_contato(uuid,text,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.meta_atrasados_contato(uuid,text,uuid,text,text) TO service_role;
CREATE OR REPLACE FUNCTION public.meta_atrasados_salvar(p_tenant uuid,p_template text,p_idioma text,p_map jsonb,p_ativo boolean,p_min integer DEFAULT 3,p_max integer DEFAULT 8) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') OR NOT public.user_can_access_tenant(auth.uid(),p_tenant) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
 IF p_template IS NULL OR length(p_template)<1 OR p_idioma IS NULL OR p_min<1 OR p_max<=p_min OR p_max>60 OR jsonb_typeof(p_map)<>'object' THEN RAISE EXCEPTION 'Configuração inválida'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_each_text(p_map) WHERE value NOT IN ('nome','credor','vencimento')) THEN RAISE EXCEPTION 'Mapeamento de variável inválido'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.meta_templates_mestre WHERE criado_por=auth.uid() AND tenant_id=p_tenant AND nome=p_template AND idioma=p_idioma AND categoria='UTILITY') THEN RAISE EXCEPTION 'Selecione um template Utility próprio'; END IF;
 INSERT INTO public.meta_atrasados_config(owner_id,tenant_id,template_nome,idioma,variaveis_map,ativo,ativado_em,min_seg,max_seg) VALUES(auth.uid(),p_tenant,p_template,p_idioma,p_map,p_ativo,CASE WHEN p_ativo THEN now() END,p_min,p_max) ON CONFLICT(owner_id,tenant_id) DO UPDATE SET template_nome=p_template,idioma=p_idioma,variaveis_map=p_map,ativo=p_ativo,ativado_em=CASE WHEN p_ativo THEN coalesce(meta_atrasados_config.ativado_em,now()) ELSE meta_atrasados_config.ativado_em END,min_seg=p_min,max_seg=p_max,atualizado_em=now() RETURNING id INTO v_id;
 RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION public.meta_atrasados_salvar(uuid,text,text,jsonb,boolean,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.meta_atrasados_salvar(uuid,text,text,jsonb,boolean,integer,integer) TO authenticated;