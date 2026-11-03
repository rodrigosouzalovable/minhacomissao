CREATE INDEX IF NOT EXISTS idx_meta_envios_log_enviado_inst ON public.meta_whatsapp_envios_log (enviado_em DESC) INCLUDE (instancia_id, status);

CREATE OR REPLACE FUNCTION public.meta_entradas_por_sufixos(p_instancias uuid[], p_sufixos text[])
RETURNS TABLE(instancia_id uuid, sufixo text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT DISTINCT m.instancia_id, public.phone_suffix8(m.telefone)
  FROM public.meta_whatsapp_mensagens m
  WHERE m.instancia_id = ANY(p_instancias)
    AND public.phone_suffix8(m.telefone) = ANY(p_sufixos)
    AND m.direcao = 'entrada';
$$;
REVOKE ALL ON FUNCTION public.meta_entradas_por_sufixos(uuid[], text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.meta_entradas_por_sufixos(uuid[], text[]) TO service_role;