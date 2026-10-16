CREATE OR REPLACE FUNCTION public.meta_atrasados_candidatos(p_owner uuid, p_tenant uuid, p_dia date, p_template text, p_idioma text, p_limite integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH candidates AS (
 SELECT p.id pagamento_id,p.acordo_id,p.data_prevista,p.valor_parcela,a.cliente_nome,a.cliente_telefone,a.cliente_cpf,a.user_id,a.empresa,pr.nome atendente_nome,
 CASE WHEN p_dia-p.data_prevista>=7 THEN 7 WHEN p_dia-p.data_prevista>=3 THEN 3 WHEN p_dia-p.data_prevista>=1 THEN 1 ELSE 0 END etapa,
 row_number() OVER(PARTITION BY a.id ORDER BY p.data_prevista DESC,p.id) rn
 FROM public.pagamentos p JOIN public.acordos a ON a.id=p.acordo_id LEFT JOIN public.profiles pr ON pr.id=a.user_id
 WHERE p_dia=(now() AT TIME ZONE 'America/Sao_Paulo')::date AND p.status='pendente' AND a.status='ativo' AND p.data_prevista BETWEEN p_dia-10 AND p_dia AND public.user_can_access_tenant(a.user_id,p_tenant)
 AND NOT EXISTS(SELECT 1 FROM public.meta_atrasados_envios l WHERE l.pagamento_id=p.id AND l.vencimento=p.data_prevista AND l.etapa=(CASE WHEN p_dia-p.data_prevista>=7 THEN 7 WHEN p_dia-p.data_prevista>=3 THEN 3 WHEN p_dia-p.data_prevista>=1 THEN 1 ELSE 0 END) AND (l.status<>'pendente' OR l.dia_envio=p_dia))
 AND NOT EXISTS(SELECT 1 FROM public.meta_atrasados_envios l WHERE l.acordo_id=a.id AND l.dia_envio=p_dia AND l.status IN ('reservado','aceito','incerto'))
), chosen AS (
 SELECT c.*,s.sender FROM candidates c LEFT JOIN LATERAL (
 SELECT jsonb_build_object('id',i.id,'nome',i.nome,'folder_id',(CASE WHEN ct.id IS NOT NULL THEN ct.folder_id ELSE i.folder_padrao_id END),'template_id',t.id,'body_text',t.body_text,'variaveis',t.variaveis,'meta_bm_id',i.meta_bm_id,'ultima_msg_entrada_em',ct.ultima_msg_entrada_em) sender
 FROM public.meta_whatsapp_instances i JOIN public.meta_whatsapp_templates t ON t.instancia_id=i.id AND t.nome_template=p_template AND t.idioma=p_idioma AND t.status='approved' AND upper(t.categoria)='UTILITY'
 LEFT JOIN LATERAL (SELECT cc.* FROM public.meta_whatsapp_contatos cc WHERE cc.instancia_id=i.id AND public.phone_suffix8(cc.telefone)=public.phone_suffix8(c.cliente_telefone) ORDER BY cc.atualizado_em DESC LIMIT 1) ct ON true
 JOIN public.user_permissions up ON up.user_id=c.user_id AND up.atende_inbox_meta=true
 JOIN public.meta_atendimento_fila f ON f.user_id=c.user_id AND f.ativo AND f.tenant_id=p_tenant
 JOIN public.meta_whatsapp_etiquetas e ON e.id=f.etiqueta_id AND e.ativa AND e.user_id=p_owner AND e.nome ILIKE 'Atendente:%'
 WHERE i.user_id=p_owner AND i.tenant_id=p_tenant AND i.ativo AND coalesce(i.provider,'meta')='meta' AND i.saude_quality='GREEN' AND i.saude_status='CONNECTED'
 AND i.qualidade_leitura_ok=true AND i.saude_checked_at>now()-interval '6 hours' AND coalesce(i.estado_pool,'ativo')='ativo' AND NOT coalesce(i.pool_fora_manual,false) AND NOT coalesce(i.instancia_teste_aquecimento,false)
 AND (i.pausa_automatica_ate IS NULL OR i.pausa_automatica_ate<now()) AND (i.quarentena_ate IS NULL OR i.quarentena_ate<now()) AND (i.rate_limit_ate IS NULL OR i.rate_limit_ate<now())
 AND ((CASE WHEN ct.id IS NOT NULL THEN ct.folder_id ELSE i.folder_padrao_id END IS NULL AND EXISTS(SELECT 1 FROM public.meta_inbox_default_members m WHERE m.user_id=c.user_id AND NOT coalesce(m.admin,false))) OR EXISTS(SELECT 1 FROM public.meta_inbox_folder_members m WHERE m.user_id=c.user_id AND m.folder_id=(CASE WHEN ct.id IS NOT NULL THEN ct.folder_id ELSE i.folder_padrao_id END) AND NOT coalesce(m.admin,false)))
 AND NOT EXISTS(SELECT 1 FROM public.meta_whatsapp_contato_etiquetas ce JOIN public.meta_whatsapp_etiquetas ee ON ee.id=ce.etiqueta_id WHERE ce.contato_id=ct.id AND ee.nome ILIKE 'Atendente:%' AND ce.etiqueta_id<>e.id)
 ORDER BY coalesce(i.enviados_hoje,0),i.id LIMIT 1
 ) s ON true WHERE c.rn=1 ORDER BY c.data_prevista DESC,c.pagamento_id LIMIT greatest(1,least(p_limite,50))
)
SELECT coalesce(jsonb_agg(to_jsonb(chosen)-'rn'),'[]'::jsonb) FROM chosen;
$function$;

CREATE OR REPLACE FUNCTION public.meta_atrasados_reservar(p_config uuid, p_pagamento uuid, p_etapa integer, p_vencimento date, p_dia date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_id uuid; v_p public.pagamentos%ROWTYPE; v_a public.acordos%ROWTYPE; v_cfg public.meta_atrasados_config%ROWTYPE;
BEGIN
 SELECT * INTO v_cfg FROM public.meta_atrasados_config WHERE id=p_config AND ativo FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO v_p FROM public.pagamentos WHERE id=p_pagamento AND status='pendente' AND data_prevista=p_vencimento FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO v_a FROM public.acordos WHERE id=v_p.acordo_id AND status='ativo' FOR UPDATE;
 IF NOT FOUND OR NOT public.user_can_access_tenant(v_a.user_id,v_cfg.tenant_id) THEN RETURN NULL; END IF;
 IF p_dia<>(now() AT TIME ZONE 'America/Sao_Paulo')::date OR (p_dia-p_vencimento) NOT BETWEEN 0 AND 10 OR p_etapa<>(CASE WHEN p_dia-p_vencimento>=7 THEN 7 WHEN p_dia-p_vencimento>=3 THEN 3 WHEN p_dia-p_vencimento>=1 THEN 1 ELSE 0 END) THEN RETURN NULL; END IF;
 IF EXISTS(SELECT 1 FROM public.meta_atrasados_envios WHERE acordo_id=v_a.id AND dia_envio=p_dia AND status IN ('reservado','aceito','incerto')) THEN RETURN NULL; END IF;
 INSERT INTO public.meta_atrasados_envios(config_id,pagamento_id,acordo_id,vencimento,etapa,dia_envio,user_id,telefone,cliente_nome,status) VALUES(p_config,v_p.id,v_a.id,p_vencimento,p_etapa,p_dia,v_a.user_id,coalesce(v_a.cliente_telefone,''),v_a.cliente_nome,'reservado') ON CONFLICT(pagamento_id,vencimento,etapa) DO UPDATE SET status='reservado',dia_envio=p_dia,atualizado_em=now() WHERE meta_atrasados_envios.status='pendente' RETURNING id INTO v_id;
 RETURN v_id;
EXCEPTION WHEN unique_violation THEN RETURN NULL;
END; $function$;