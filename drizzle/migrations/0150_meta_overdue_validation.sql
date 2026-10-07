CREATE OR REPLACE FUNCTION public.meta_atrasados_salvar(p_tenant uuid,p_template text,p_idioma text,p_map jsonb,p_ativo boolean,p_min integer DEFAULT 3,p_max integer DEFAULT 8) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') OR NOT public.user_can_access_tenant(auth.uid(),p_tenant) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
 IF p_template IS NULL OR length(p_template) NOT BETWEEN 1 AND 512 OR p_idioma IS NULL OR length(p_idioma) NOT BETWEEN 1 AND 20 OR p_min IS NULL OR p_max IS NULL OR p_ativo IS NULL OR p_min<1 OR p_max<=p_min OR p_max>60 OR p_map IS NULL OR jsonb_typeof(p_map)<>'object' THEN RAISE EXCEPTION 'Configuração inválida'; END IF;
 IF p_map='{}'::jsonb OR EXISTS(SELECT 1 FROM jsonb_each(p_map) WHERE key !~ '^[A-Za-z0-9_]{1,64}$' OR jsonb_typeof(value)<>'string' OR value#>>'{}' NOT IN ('nome','credor','vencimento')) THEN RAISE EXCEPTION 'Mapeamento de variável inválido'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.meta_templates_mestre WHERE criado_por=auth.uid() AND tenant_id=p_tenant AND nome=p_template AND idioma=p_idioma AND categoria='UTILITY') THEN RAISE EXCEPTION 'Selecione um template Utility próprio'; END IF;
 INSERT INTO public.meta_atrasados_config(owner_id,tenant_id,template_nome,idioma,variaveis_map,ativo,ativado_em,min_seg,max_seg) VALUES(auth.uid(),p_tenant,p_template,p_idioma,p_map,p_ativo,CASE WHEN p_ativo THEN now() END,p_min,p_max) ON CONFLICT(owner_id,tenant_id) DO UPDATE SET template_nome=p_template,idioma=p_idioma,variaveis_map=p_map,ativo=p_ativo,ativado_em=CASE WHEN p_ativo THEN coalesce(meta_atrasados_config.ativado_em,now()) ELSE meta_atrasados_config.ativado_em END,min_seg=p_min,max_seg=p_max,atualizado_em=now() RETURNING id INTO v_id;
 RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION public.meta_atrasados_salvar(uuid,text,text,jsonb,boolean,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.meta_atrasados_salvar(uuid,text,text,jsonb,boolean,integer,integer) TO authenticated;
DO $migration$ DECLARE definition text; BEGIN
 SELECT pg_get_functiondef('public.meta_atrasados_candidatos(uuid,uuid,date,text,text,integer)'::regprocedure) INTO definition;
 definition:=replace(definition, 'WHERE p.status=''pendente''', 'WHERE p_dia=(now() AT TIME ZONE ''America/Sao_Paulo'')::date AND p.status=''pendente''');
 EXECUTE definition;
END $migration$;