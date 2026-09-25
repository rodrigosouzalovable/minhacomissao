CREATE OR REPLACE FUNCTION public.certificado_sufixos_usados_por_candidatos(p_sufixos text[])
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT s.sufixo), ARRAY[]::text[])
  FROM (SELECT DISTINCT sufixo FROM unnest(p_sufixos) AS sufixo WHERE length(sufixo) = 8) AS s
  WHERE EXISTS (
    SELECT 1
    FROM public.certificado_leads AS l
    JOIN public.certificado_prospeccao_envios AS e ON e.lead_id = l.id
    WHERE right(regexp_replace(coalesce(l.telefone_principal, ''), '\D', '', 'g'), 8) = s.sufixo
      AND e.status IN ('reservado', 'enviado', 'entregue', 'lido', 'respondido')
  );
$$;
REVOKE ALL ON FUNCTION public.certificado_sufixos_usados_por_candidatos(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.certificado_sufixos_usados_por_candidatos(text[]) TO service_role;
COMMENT ON FUNCTION public.certificado_sufixos_usados_por_candidatos(text[]) IS 'Verifica apenas sufixos candidatos de leads do Certificado, sem paginar todo o histórico de envios.';