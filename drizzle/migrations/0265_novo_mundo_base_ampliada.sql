CREATE OR REPLACE FUNCTION public.importar_contatos_novo_mundo(p_arquivo text, p_rows jsonb, p_resumo jsonb, p_autorizado boolean, p_simulacao boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '120s'
AS $function$
DECLARE v_owner uuid:=auth.uid(); v_lote uuid; v_row jsonb; v_suffix text; v_count integer:=0; v_bloq integer:=0; v_usado integer:=0; v_exist integer:=0; v_pending integer; v_n integer; v_res jsonb;
BEGIN
 IF v_owner IS NULL OR NOT public.has_role(v_owner,'admin') OR v_owner<>'ee649720-b8ce-47a2-859e-100a3a9ae6bb'::uuid THEN RAISE EXCEPTION 'Apenas o administrador proprietário da recuperação pode importar esta base'; END IF;
 IF p_autorizado IS DISTINCT FROM true OR p_arquivo IS NULL OR length(p_arquivo) NOT BETWEEN 1 AND 255 OR jsonb_typeof(p_rows) IS DISTINCT FROM 'array' OR jsonb_array_length(p_rows) NOT BETWEEN 1 AND 30000 OR jsonb_typeof(p_resumo) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Arquivo, autorização ou contatos inválidos'; END IF;
 v_n:=(p_resumo->>'total')::integer;
 IF v_n NOT BETWEEN 1 AND 30000 OR v_n<jsonb_array_length(p_rows) THEN RAISE EXCEPTION 'Limite de 30.000 linhas de contatos por importação'; END IF;
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
 IF v_pending+v_count>100000 THEN RAISE EXCEPTION 'Estoque comporta apenas mais % contatos; este lote adicionaria %',100000-v_pending,v_count; END IF;
 v_res:=jsonb_build_object('total',v_n,'adicionados',v_count,'bloqueados',v_bloq,'ja_utilizados',v_usado,'ja_pendentes',v_exist,'invalidos',coalesce((p_resumo->>'invalidos')::integer,0),'duplicados',coalesce((p_resumo->>'duplicados')::integer,0),'capacidade_livre',100000-v_pending-v_count);
 IF p_simulacao THEN RETURN v_res; END IF;
 IF v_count=0 THEN RAISE EXCEPTION 'Nenhum contato novo elegível para adicionar'; END IF;
 INSERT INTO public.meta_novo_mundo_lotes(user_id,arquivo,recebido,adicionados,descartados,resumo,autorizacao) VALUES(v_owner,p_arquivo,v_n,v_count,v_n-v_count,v_res,'Proprietário declarou autorização WhatsApp dos contatos Novo Mundo deste lote') RETURNING id INTO v_lote;
 INSERT INTO public.meta_novo_mundo_contatos(user_id,lote_id,telefone,telefone_sufixo,var1,var2)
 SELECT v_owner,v_lote,r->>'telefone',right(r->>'telefone',8),r->>'var1',r->>'var2' FROM jsonb_array_elements(p_rows) r WHERE NOT EXISTS(SELECT 1 FROM public.meta_destinatario_supressao s WHERE s.telefone_sufixo=right(r->>'telefone',8)) AND NOT EXISTS(SELECT 1 FROM public.meta_maps_aquecimento_consumidos u WHERE u.telefone_sufixo=right(r->>'telefone',8)) AND NOT EXISTS(SELECT 1 FROM public.meta_recuperacao_log l WHERE l.cadastral AND l.telefone_sufixo=right(r->>'telefone',8)) AND NOT EXISTS(SELECT 1 FROM public.meta_novo_mundo_contatos c WHERE c.user_id=v_owner AND c.telefone_sufixo=right(r->>'telefone',8));
 GET DIAGNOSTICS v_n=ROW_COUNT;
 IF v_n<>v_count THEN RAISE EXCEPTION 'A elegibilidade mudou durante a conferência. Atualize e tente importar novamente'; END IF;
 INSERT INTO public.meta_novo_mundo_config(user_id) VALUES(v_owner) ON CONFLICT DO NOTHING;
 RETURN v_res||jsonb_build_object('lote_id',v_lote);
END $function$;