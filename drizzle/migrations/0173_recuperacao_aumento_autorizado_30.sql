DO $ddl$
DECLARE v_name text; v_def text;
BEGIN
 FOREACH v_name IN ARRAY ARRAY['limitar_orcamento_recuperacao','reservar_novo_mundo','reservar_recuperacao_cadastral','resumo_base_novo_mundo'] LOOP
  SELECT pg_get_functiondef(p.oid) INTO STRICT v_def FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=v_name;
  v_def:=replace(replace(v_def,'20.30','26.39'),'least(20,greatest(1,coalesce(i.recuperacao_msgs_meta_dia,10)))','least(26,greatest(1,coalesce(i.recuperacao_msgs_meta_dia,13)))');
  EXECUTE v_def;
 END LOOP;
END $ddl$;
CREATE OR REPLACE FUNCTION public.autorizar_aumento_recuperacao_30()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_owner uuid:=auth.uid(); v_teto numeric; v_n integer;
BEGIN
 IF v_owner IS NULL OR v_owner<>'ee649720-b8ce-47a2-859e-100a3a9ae6bb'::uuid OR NOT public.has_role(v_owner,'admin') THEN RAISE EXCEPTION 'Apenas o administrador proprietário pode autorizar'; END IF;
 SELECT custo_limite_diario_brl INTO v_teto FROM public.meta_recuperacao_cadastral_config WHERE user_id=v_owner AND ativo FOR UPDATE;
 IF v_teto=26.39 THEN RETURN jsonb_build_object('ja_aplicado',true,'teto',26.39); END IF;
 IF v_teto IS DISTINCT FROM 20.30 THEN RAISE EXCEPTION 'Teto anterior mudou; revise a autorização'; END IF;
 UPDATE public.meta_recuperacao_cadastral_config SET custo_limite_diario_brl=26.39,custo_autorizado_em=now(),custo_autorizado_por=v_owner WHERE user_id=v_owner;
 UPDATE public.meta_envio_pool_config SET recuperacao_msgs_min_dia=13,recuperacao_msgs_max_dia=26 WHERE id=1;
 UPDATE public.meta_whatsapp_instances SET recuperacao_msgs_meta_dia=least(26,round(recuperacao_msgs_meta_dia*1.30)::integer) WHERE user_id=v_owner AND provider='meta' AND recuperacao_ativa AND recuperacao_msgs_meta_dia>5;
 GET DIAGNOSTICS v_n=ROW_COUNT;
 RETURN jsonb_build_object('teto',26.39,'metas_atualizadas',v_n,'aumento_percentual',30,'reducoes_por_piora_preservadas',true);
END $$;
REVOKE ALL ON FUNCTION public.autorizar_aumento_recuperacao_30() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.autorizar_aumento_recuperacao_30() TO authenticated;
COMMENT ON FUNCTION public.autorizar_aumento_recuperacao_30() IS 'Autorização administrativa única de 10/10/2026: metas +30%, teto R$26,39; preserva reduções por piora, horários, intervalos e bloqueios.';