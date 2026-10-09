ALTER TABLE public.meta_whatsapp_contatos ADD COLUMN IF NOT EXISTS telefone_busca_invertido text GENERATED ALWAYS AS (reverse(regexp_replace(telefone, '\D', '', 'g'))) STORED;
CREATE INDEX IF NOT EXISTS idx_meta_contatos_phone_search_rls ON public.meta_whatsapp_contatos (telefone_busca_invertido COLLATE "C");
CREATE OR REPLACE FUNCTION public.meta_inbox_phone_search(p_suffix text, p_limit integer DEFAULT 200)
RETURNS TABLE (id uuid, instancia_id uuid, telefone text, nome text, nome_perfil text, cpf text, ultima_mensagem text, ultima_mensagem_em timestamptz, ultima_msg_entrada_em timestamptz, sla_dispensado_em timestamptz, nao_lido integer, fixado boolean, arquivado boolean, folder_id uuid, credor text)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public
AS $$
DECLARE v_prefix text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF p_suffix IS NULL OR p_suffix !~ '^[0-9]{4,8}$' THEN RAISE EXCEPTION 'Phone suffix must contain 4 to 8 digits' USING ERRCODE = '22023'; END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 2000 THEN RAISE EXCEPTION 'Limit must be between 1 and 2000' USING ERRCODE = '22023'; END IF;
  v_prefix := reverse(p_suffix);
  RETURN QUERY
    SELECT c.id, c.instancia_id, c.telefone, c.nome, c.nome_perfil, c.cpf, c.ultima_mensagem, c.ultima_mensagem_em, c.ultima_msg_entrada_em, c.sla_dispensado_em, c.nao_lido, c.fixado, c.arquivado, c.folder_id, c.credor
    FROM public.meta_whatsapp_contatos c
    WHERE (c.telefone_busca_invertido COLLATE "C") >= (v_prefix COLLATE "C")
      AND (c.telefone_busca_invertido COLLATE "C") < ((v_prefix || ':') COLLATE "C")
    ORDER BY c.ultima_mensagem_em DESC NULLS LAST, c.id
    LIMIT p_limit;
END;
$$;
REVOKE ALL ON FUNCTION public.meta_inbox_phone_search(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.meta_inbox_phone_search(text, integer) TO authenticated;
COMMENT ON COLUMN public.meta_whatsapp_contatos.telefone_busca_invertido IS 'Stored normalized phone permits leakproof indexed range conditions under contact RLS.';