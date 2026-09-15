ALTER TABLE public.google_maps_buscas
  ADD COLUMN IF NOT EXISTS provedor_utilizado TEXT;

CREATE INDEX IF NOT EXISTS idx_google_maps_leads_created_whatsapp
  ON public.google_maps_leads (created_at DESC, tem_whatsapp);

CREATE INDEX IF NOT EXISTS idx_google_maps_leads_phone_suffix
  ON public.google_maps_leads ((right(regexp_replace(COALESCE(telefone_internacional, telefone, ''), '\\D', '', 'g'), 8)))
  WHERE COALESCE(telefone_internacional, telefone) IS NOT NULL;

CREATE OR REPLACE FUNCTION public.gm_status_provedores()
RETURNS TABLE (
  provedor TEXT,
  total_consultas INTEGER,
  limite_maximo INTEGER,
  limite_bloqueio INTEGER,
  pode_buscar BOOLEAN,
  percentual_consumido NUMERIC,
  configurada BOOLEAN,
  ativa BOOLEAN,
  data_reset DATE
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mes DATE := public.gm_mes_atual();
  reserva_ativa BOOLEAN := FALSE;
  tem_principal BOOLEAN := FALSE;
  tem_reserva BOOLEAN := FALSE;
BEGIN
  SELECT COALESCE(c.reserva_ativa_mes = mes, FALSE),
         COALESCE(NULLIF(BTRIM(c.api_key), ''), '') <> '',
         COALESCE(NULLIF(BTRIM(c.api_key_reserva), ''), '') <> ''
    INTO reserva_ativa, tem_principal, tem_reserva
  FROM public.google_maps_config c
  WHERE c.id = 1;

  RETURN QUERY
  WITH nomes(provedor) AS (
    VALUES ('principal'::TEXT), ('reserva'::TEXT)
  ), uso AS (
    SELECT n.provedor,
           COALESCE(u.total_consultas, 0)::INTEGER AS total_consultas,
           COALESCE(u.limite_maximo, 5000)::INTEGER AS limite_maximo,
           COALESCE(u.limite_bloqueio, 4800)::INTEGER AS limite_bloqueio
    FROM nomes n
    LEFT JOIN public.google_maps_uso_provedor u
      ON u.mes_referencia = mes AND u.provedor = n.provedor
  )
  SELECT u.provedor,
         u.total_consultas,
         u.limite_maximo,
         u.limite_bloqueio,
         u.total_consultas < u.limite_bloqueio,
         ROUND((u.total_consultas::NUMERIC / NULLIF(u.limite_maximo, 0)) * 100, 2),
         CASE WHEN u.provedor = 'principal' THEN tem_principal ELSE tem_reserva END,
         CASE WHEN reserva_ativa THEN u.provedor = 'reserva' ELSE u.provedor = 'principal' END,
         (mes + INTERVAL '1 month')::DATE
  FROM uso u
  ORDER BY CASE WHEN u.provedor = 'principal' THEN 0 ELSE 1 END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.gm_status_provedores() TO authenticated, service_role;