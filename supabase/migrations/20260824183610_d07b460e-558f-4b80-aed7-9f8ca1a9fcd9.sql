CREATE OR REPLACE FUNCTION public.meta_atendimentos_por_atendente(p_inicio timestamptz, p_fim timestamptz)
RETURNS TABLE (user_id uuid, nome text, atendidas bigint, iniciadas bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.user_id,
         COALESCE(p.nome, 'Sem nome') AS nome,
         COUNT(DISTINCT m.telefone) FILTER (WHERE m.template_nome IS NULL) AS atendidas,
         COUNT(DISTINCT m.telefone) FILTER (WHERE m.template_nome IS NOT NULL) AS iniciadas
  FROM public.meta_whatsapp_mensagens m
  LEFT JOIN public.profiles p ON p.id = m.user_id
  WHERE m.direcao = 'saida'
    AND m.timestamp_msg >= p_inicio
    AND m.timestamp_msg < p_fim
    AND m.user_id IS NOT NULL
    AND (public.has_role(auth.uid(), 'admin') OR m.user_id = auth.uid())
  GROUP BY m.user_id, p.nome
  ORDER BY 3 DESC, 4 DESC
$$;

GRANT EXECUTE ON FUNCTION public.meta_atendimentos_por_atendente(timestamptz, timestamptz) TO authenticated;