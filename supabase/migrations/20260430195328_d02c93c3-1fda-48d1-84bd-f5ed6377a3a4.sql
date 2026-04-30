CREATE OR REPLACE FUNCTION public.get_acordo_status_flags(p_acordo_ids uuid[])
RETURNS TABLE (
  acordo_id uuid,
  tem_pago boolean,
  tem_vencida boolean,
  data_vencida_mais_antiga date,
  proxima_vencimento date
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    a.id AS acordo_id,
    COALESCE(bool_or(p.status = 'pago'), false) AS tem_pago,
    COALESCE(bool_or(p.status = 'pendente' AND p.data_prevista < CURRENT_DATE), false) AS tem_vencida,
    MIN(p.data_prevista) FILTER (WHERE p.status = 'pendente' AND p.data_prevista < CURRENT_DATE) AS data_vencida_mais_antiga,
    MIN(p.data_prevista) FILTER (WHERE p.status = 'pendente' AND p.data_prevista >= CURRENT_DATE) AS proxima_vencimento
  FROM unnest(p_acordo_ids) AS a(id)
  LEFT JOIN public.pagamentos p ON p.acordo_id = a.id
  GROUP BY a.id
$$;