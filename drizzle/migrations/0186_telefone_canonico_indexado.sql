CREATE INDEX IF NOT EXISTS idx_meta_envios_log_inst_suffix ON public.meta_whatsapp_envios_log (instancia_id, public.phone_suffix8(telefone), enviado_em DESC);
CREATE INDEX IF NOT EXISTS idx_meta_contatos_inst_suffix_upd ON public.meta_whatsapp_contatos (instancia_id, public.phone_suffix8(telefone), atualizado_em DESC);
CREATE OR REPLACE FUNCTION public.meta_telefone_canonico(p_instancia uuid, p_telefone text, p_incluir_historico boolean DEFAULT true)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE s text := public.phone_suffix8(p_telefone); r text;
BEGIN
  IF s IS NULL THEN RETURN NULL; END IF;
  SELECT telefone INTO r FROM public.meta_whatsapp_contatos WHERE instancia_id=p_instancia AND public.phone_suffix8(telefone)=s AND telefone<>p_telefone ORDER BY atualizado_em DESC LIMIT 1;
  IF r IS NOT NULL OR NOT p_incluir_historico THEN RETURN r; END IF;
  SELECT telefone INTO r FROM public.meta_whatsapp_envios_log WHERE instancia_id=p_instancia AND public.phone_suffix8(telefone)=s AND telefone<>p_telefone ORDER BY enviado_em DESC LIMIT 1;
  IF r IS NOT NULL THEN RETURN r; END IF;
  SELECT telefone INTO r FROM public.meta_whatsapp_mensagens WHERE instancia_id=p_instancia AND public.phone_suffix8(telefone)=s AND telefone<>p_telefone ORDER BY timestamp_msg DESC NULLS LAST LIMIT 1;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.meta_telefone_canonico(uuid,text,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.meta_telefone_canonico(uuid,text,boolean) TO service_role;