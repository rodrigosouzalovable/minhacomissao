CREATE TABLE public.portal_consulta_limites (chave text PRIMARY KEY, inicio timestamptz NOT NULL DEFAULT now(), quantidade integer NOT NULL DEFAULT 0);
GRANT ALL ON public.portal_consulta_limites TO service_role;
ALTER TABLE public.portal_consulta_limites ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.portal_reservar_consulta(p_chave text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_q integer;
BEGIN
 IF length(p_chave)<>64 THEN RETURN false; END IF;
 INSERT INTO public.portal_consulta_limites AS l(chave,inicio,quantidade) VALUES(p_chave,now(),1) ON CONFLICT(chave) DO UPDATE SET inicio=CASE WHEN l.inicio < now()-interval '1 hour' THEN now() ELSE l.inicio END, quantidade=CASE WHEN l.inicio < now()-interval '1 hour' THEN 1 ELSE l.quantidade+1 END RETURNING quantidade INTO v_q;
 RETURN v_q<=90;
END; $$;
REVOKE ALL ON FUNCTION public.portal_reservar_consulta(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_reservar_consulta(text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.portal_consultar_carteira(text,text) FROM anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_consultar_carteira(text,text) TO service_role;