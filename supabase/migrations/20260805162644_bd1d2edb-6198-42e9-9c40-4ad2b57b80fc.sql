CREATE OR REPLACE FUNCTION public.acordos_parcelas_resumo(p_acordo_ids uuid[])
RETURNS TABLE(
  acordo_id uuid,
  ultima_pendente_data date,
  ultima_paga_numero integer,
  ultima_paga_data date,
  datas date[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH permitidos AS (
    SELECT a.id
    FROM public.acordos a
    WHERE a.id = ANY(p_acordo_ids)
      AND (
        a.user_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'gestor')
        OR public.has_acordos_compartilhados(auth.uid())
      )
  )
  SELECT
    p.acordo_id,
    MAX(p.data_prevista) FILTER (WHERE p.status = 'pendente') AS ultima_pendente_data,
    (ARRAY_AGG(p.numero_parcela ORDER BY p.numero_parcela DESC)
       FILTER (WHERE p.status = 'pago' AND p.numero_parcela IS NOT NULL AND p.data_paga IS NOT NULL))[1] AS ultima_paga_numero,
    (ARRAY_AGG(p.data_paga ORDER BY p.numero_parcela DESC)
       FILTER (WHERE p.status = 'pago' AND p.numero_parcela IS NOT NULL AND p.data_paga IS NOT NULL))[1] AS ultima_paga_data,
    ARRAY_AGG(p.data_prevista) AS datas
  FROM public.pagamentos p
  JOIN permitidos pe ON pe.id = p.acordo_id
  GROUP BY p.acordo_id
$$;

REVOKE ALL ON FUNCTION public.acordos_parcelas_resumo(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.acordos_parcelas_resumo(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.acordos_parcelas_resumo(uuid[]) TO service_role;