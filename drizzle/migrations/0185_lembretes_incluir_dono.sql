DO $$
DECLARE d text;
BEGIN
 d := pg_get_functiondef('public.meta_atrasados_candidatos(uuid,uuid,date,text,text,integer)'::regprocedure);
 d := replace(d, 'AND ((CASE WHEN ct.id IS NOT NULL', 'AND (c.user_id=p_owner OR (CASE WHEN ct.id IS NOT NULL');
 EXECUTE d;
 d := pg_get_functiondef('public.meta_atrasados_contato(uuid,text,uuid,text,text)'::regprocedure);
 d := replace(d, 'IF (v_folder IS NULL AND NOT EXISTS', 'IF p_user<>v_inst.user_id AND ((v_folder IS NULL AND NOT EXISTS');
 d := replace(d, 'NOT coalesce(admin,false))) THEN RAISE EXCEPTION ''Funcionário não pertence', 'NOT coalesce(admin,false)))) THEN RAISE EXCEPTION ''Funcionário não pertence');
 EXECUTE d;
END $$;