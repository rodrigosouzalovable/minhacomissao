DO $ddl$
DECLARE v_def text;
BEGIN
 SELECT pg_get_functiondef(p.oid) INTO STRICT v_def FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='reservar_novo_mundo';
 v_def:=replace(v_def,'least(26,greatest(1,coalesce(i.recuperacao_msgs_meta_dia,13)))','least(40,greatest(1,coalesce(i.recuperacao_msgs_meta_dia,20)))');
 v_def:=replace(v_def,'1200+floor(random()*1201)','480+floor(random()*421)');
 IF position('least(40,' IN v_def)=0 OR position('480+floor(random()*421)' IN v_def)=0 THEN RAISE EXCEPTION 'reservar_novo_mundo mudou; revise a aceleração'; END IF;
 EXECUTE v_def;
END $ddl$;
UPDATE public.meta_envio_pool_config SET recuperacao_msgs_min_dia=20,recuperacao_msgs_max_dia=40,recuperacao_intervalo_min_seg=480,recuperacao_intervalo_max_seg=900 WHERE id=1;
UPDATE public.meta_whatsapp_instances SET recuperacao_msgs_meta_dia=40,recuperacao_proximo_envio_em=least(coalesce(recuperacao_proximo_envio_em,now()),now()+interval '15 minutes')
 WHERE user_id='ee649720-b8ce-47a2-859e-100a3a9ae6bb'::uuid AND provider='meta' AND recuperacao_ativa AND recuperacao_msgs_meta_dia>5;
