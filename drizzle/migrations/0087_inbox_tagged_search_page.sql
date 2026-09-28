CREATE FUNCTION public.meta_inbox_tagged_search_page(
  p_etiquetas uuid[], p_qualificacoes uuid[], p_busca text,
  p_instancia uuid DEFAULT NULL, p_folder uuid DEFAULT NULL,
  p_filtrar_folder boolean DEFAULT true, p_arquivado boolean DEFAULT false,
  p_filtrar_arquivado boolean DEFAULT true, p_inicio timestamptz DEFAULT NULL,
  p_fim timestamptz DEFAULT NULL, p_limit integer DEFAULT 300, p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid, instancia_id uuid, telefone text, nome text, cpf text,
  ultima_mensagem text, ultima_mensagem_em timestamptz, ultima_msg_entrada_em timestamptz,
  sla_dispensado_em timestamptz, nao_lido integer, fixado boolean, arquivado boolean,
  folder_id uuid, credor text
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
 SELECT c.id, c.instancia_id, c.telefone, c.nome, c.cpf, c.ultima_mensagem,
        c.ultima_mensagem_em, c.ultima_msg_entrada_em, c.sla_dispensado_em,
        c.nao_lido, c.fixado, c.arquivado, c.folder_id, c.credor
 FROM public.meta_whatsapp_contatos c
 WHERE auth.uid() IS NOT NULL
   AND cardinality(p_etiquetas) BETWEEN 1 AND 50
   AND EXISTS (SELECT 1 FROM public.meta_whatsapp_contato_etiquetas ce
               WHERE ce.contato_id = c.id AND ce.etiqueta_id = ANY(p_etiquetas))
   AND (cardinality(p_qualificacoes) = 0 OR EXISTS (
     SELECT 1 FROM public.meta_contato_qualificacao cq
     WHERE cq.contato_id = c.id AND cq.qualificacao_id = ANY(p_qualificacoes)))
   AND (p_busca IS NULL OR length(trim(p_busca)) = 0 OR
        c.nome ILIKE '%' || replace(replace(trim(p_busca), '%', '\%'), '_', '\_') || '%' OR
        c.telefone ILIKE '%' || regexp_replace(p_busca, '[^0-9]', '', 'g') || '%')
   AND (p_instancia IS NULL OR c.instancia_id = p_instancia)
   AND (NOT p_filtrar_folder OR c.folder_id IS NOT DISTINCT FROM p_folder)
   AND (NOT p_filtrar_arquivado OR c.arquivado = p_arquivado)
   AND (p_inicio IS NULL OR c.ultima_mensagem_em >= p_inicio)
   AND (p_fim IS NULL OR c.ultima_mensagem_em <= p_fim)
 ORDER BY c.ultima_mensagem_em DESC NULLS LAST, c.id DESC
 LIMIT LEAST(GREATEST(p_limit, 1), 300) OFFSET LEAST(GREATEST(p_offset, 0), 100000)
$$;
REVOKE ALL ON FUNCTION public.meta_inbox_tagged_search_page(uuid[],uuid[],text,uuid,uuid,boolean,boolean,boolean,timestamptz,timestamptz,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.meta_inbox_tagged_search_page(uuid[],uuid[],text,uuid,uuid,boolean,boolean,boolean,timestamptz,timestamptz,integer,integer) TO authenticated;