ALTER TABLE public.google_maps_config
  ADD COLUMN IF NOT EXISTS api_key_reserva TEXT,
  ADD COLUMN IF NOT EXISTS reserva_updated_by UUID,
  ADD COLUMN IF NOT EXISTS reserva_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reserva_ativa_mes DATE;

CREATE TABLE public.google_maps_uso_provedor (
  mes_referencia DATE NOT NULL,
  provedor TEXT NOT NULL CHECK (provedor IN ('principal', 'reserva')),
  total_consultas INTEGER NOT NULL DEFAULT 0,
  limite_maximo INTEGER NOT NULL DEFAULT 5000,
  limite_bloqueio INTEGER NOT NULL DEFAULT 4800,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (mes_referencia, provedor)
);

GRANT SELECT ON public.google_maps_uso_provedor TO authenticated;
GRANT ALL ON public.google_maps_uso_provedor TO service_role;

ALTER TABLE public.google_maps_uso_provedor ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view provider usage"
  ON public.google_maps_uso_provedor FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.google_maps_uso_provedor (mes_referencia, provedor, total_consultas, limite_maximo, limite_bloqueio)
SELECT mes_referencia, 'principal', total_consultas, limite_maximo, limite_bloqueio
FROM public.google_maps_uso_mensal
ON CONFLICT (mes_referencia, provedor) DO NOTHING;

CREATE OR REPLACE FUNCTION public.gm_incrementar_uso_provedor(p_provedor TEXT, p_qtd INTEGER DEFAULT 1)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  novo_total INTEGER;
BEGIN
  IF p_provedor NOT IN ('principal', 'reserva') THEN
    RAISE EXCEPTION 'provedor inválido';
  END IF;
  INSERT INTO public.google_maps_uso_provedor (mes_referencia, provedor, total_consultas)
  VALUES (public.gm_mes_atual(), p_provedor, GREATEST(p_qtd, 0))
  ON CONFLICT (mes_referencia, provedor)
  DO UPDATE SET total_consultas = public.google_maps_uso_provedor.total_consultas + EXCLUDED.total_consultas,
                updated_at = now()
  RETURNING total_consultas INTO novo_total;
  RETURN novo_total;
END;
$$;

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
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mes DATE := public.gm_mes_atual();
  reserva_ativa BOOLEAN;
  tem_principal BOOLEAN;
  tem_reserva BOOLEAN;
BEGIN
  INSERT INTO public.google_maps_uso_provedor (mes_referencia, provedor)
  VALUES (mes, 'principal'), (mes, 'reserva')
  ON CONFLICT (mes_referencia, provedor) DO NOTHING;

  SELECT c.reserva_ativa_mes = mes,
         COALESCE(NULLIF(BTRIM(c.api_key), ''), '') <> '',
         COALESCE(NULLIF(BTRIM(c.api_key_reserva), ''), '') <> ''
    INTO reserva_ativa, tem_principal, tem_reserva
  FROM public.google_maps_config c WHERE c.id = 1;

  RETURN QUERY
  SELECT u.provedor,
         u.total_consultas,
         u.limite_maximo,
         u.limite_bloqueio,
         u.total_consultas < u.limite_bloqueio,
         ROUND((u.total_consultas::NUMERIC / NULLIF(u.limite_maximo, 0)) * 100, 2),
         CASE WHEN u.provedor = 'principal' THEN tem_principal ELSE tem_reserva END,
         CASE WHEN reserva_ativa THEN u.provedor = 'reserva' ELSE u.provedor = 'principal' END,
         (mes + INTERVAL '1 month')::DATE
  FROM public.google_maps_uso_provedor u
  WHERE u.mes_referencia = mes
  ORDER BY CASE WHEN u.provedor = 'principal' THEN 0 ELSE 1 END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.gm_incrementar_uso_provedor(TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.gm_status_provedores() TO authenticated, service_role;