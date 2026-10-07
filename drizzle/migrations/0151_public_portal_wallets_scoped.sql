CREATE OR REPLACE FUNCTION public.portal_credor_slug(p_value text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public AS $$ SELECT CASE regexp_replace(lower(coalesce(p_value,'')), '[^a-z0-9]', '', 'g') WHEN 'umenovomundo' THEN 'novo_mundo' WHEN 'umenovomundoaporte' THEN 'novo_mundo' WHEN 'novomundo' THEN 'novo_mundo' WHEN 'nm' THEN 'novo_mundo' WHEN 'ume' THEN 'ume' WHEN 'mundodamoda' THEN 'ume' WHEN 'odrescred' THEN 'odres_cred' ELSE NULL END $$;
REVOKE ALL ON FUNCTION public.portal_credor_slug(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_credor_slug(text) TO service_role;

CREATE OR REPLACE FUNCTION public.portal_consultar_carteira(p_cpf text, p_credor text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_cpf text; v_debitos jsonb; v_acordos jsonb; v_faixas jsonb; v_nome text; v_principal numeric; v_predominante text; v_sum integer; v_digit integer; i integer; n integer;
BEGIN
 v_cpf := regexp_replace(coalesce(p_cpf,''),'[^0-9]','','g');
 IF length(v_cpf)<>11 OR v_cpf ~ '^([0-9])\1{10}$' OR p_credor NOT IN ('novo_mundo','ume','odres_cred') OR p_credor IS NULL THEN RAISE EXCEPTION 'Consulta inválida'; END IF;
 FOR n IN 9..10 LOOP
  v_sum:=0;
  FOR i IN 1..n LOOP v_sum:=v_sum + substring(v_cpf,i,1)::integer * (n+2-i); END LOOP;
  v_digit:=(v_sum*10)%11;
  IF v_digit=10 THEN v_digit:=0; END IF;
  IF v_digit<>substring(v_cpf,n+1,1)::integer THEN RAISE EXCEPTION 'CPF inválido'; END IF;
 END LOOP;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',d.id,'nome',d.nome,'cpf',v_cpf,'valor_original',d.valor_original,'valor_atualizado',d.valor_atualizado,'descricao',d.descricao,'contrato',d.contrato,'data_vencimento',d.data_vencimento,'credor',d.credor) ORDER BY d.data_vencimento,d.id),'[]'::jsonb),sum(d.valor_original),min(d.nome)
 INTO v_debitos,v_principal,v_nome
 FROM public.devedores d
 WHERE public.cpf_normalize(d.cpf)=v_cpf AND d.ativo AND public.portal_credor_slug(d.credor)=p_credor
 AND EXISTS(SELECT 1 FROM public.tenant_members m WHERE m.user_id=d.importado_por AND m.tenant_id='00000000-0000-0000-0000-000000000001');
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',a.id,'status',a.status,'parcelas',(SELECT coalesce(jsonb_agg(jsonb_build_object('numero_parcela',p.numero_parcela,'valor_parcela',p.valor_parcela,'data_prevista',p.data_prevista,'status',p.status,'data_paga',p.data_paga) ORDER BY p.numero_parcela),'[]'::jsonb) FROM public.pagamentos p WHERE p.acordo_id=a.id)) ORDER BY a.criado_em DESC),'[]'::jsonb)
 INTO v_acordos FROM public.acordos a WHERE public.cpf_normalize(a.cliente_cpf)=v_cpf AND a.status IN ('ativo','concluido') AND public.portal_credor_slug(a.empresa)=p_credor
 AND EXISTS(SELECT 1 FROM public.tenant_members m WHERE m.user_id=a.user_id AND m.tenant_id='00000000-0000-0000-0000-000000000001');
 SELECT upper(trim(d.credor)) INTO v_predominante FROM public.devedores d WHERE public.cpf_normalize(d.cpf)=v_cpf AND d.ativo AND public.portal_credor_slug(d.credor)=p_credor AND EXISTS(SELECT 1 FROM public.tenant_members m WHERE m.user_id=d.importado_por AND m.tenant_id='00000000-0000-0000-0000-000000000001') GROUP BY upper(trim(d.credor)) ORDER BY sum(coalesce(nullif(d.valor_atualizado,0),d.valor_original,0)) DESC LIMIT 1;
 SELECT coalesce(jsonb_agg(jsonb_build_object('dias_de',f.dias_de,'dias_ate',f.dias_ate,'desc_avista',f.desc_avista,'desc_parcelado',f.desc_parcelado) ORDER BY f.dias_de),'[]'::jsonb) INTO v_faixas FROM public.credor_desconto_faixas f WHERE f.credor=v_predominante;
 RETURN jsonb_build_object('credor',p_credor,'estado',CASE WHEN jsonb_array_length(v_debitos)>0 OR jsonb_array_length(v_acordos)>0 THEN 'ok' ELSE 'empty' END,'nome',coalesce(v_nome,''),'principal',v_principal,'principalValidado',p_credor='novo_mundo','debitos',v_debitos,'acordos',v_acordos,'faixas',v_faixas);
END; $$;
REVOKE ALL ON FUNCTION public.portal_consultar_carteira(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_consultar_carteira(text,text) TO anon,authenticated,service_role;