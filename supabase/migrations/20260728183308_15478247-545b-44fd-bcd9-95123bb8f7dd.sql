
CREATE TABLE public.google_maps_uso_mensal (
  id BIGSERIAL PRIMARY KEY,
  mes_referencia DATE NOT NULL UNIQUE,
  total_consultas INTEGER NOT NULL DEFAULT 0,
  limite_maximo INTEGER NOT NULL DEFAULT 5000,
  limite_bloqueio INTEGER NOT NULL DEFAULT 4800,
  alerta_percentual INTEGER NOT NULL DEFAULT 80,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.google_maps_uso_mensal TO authenticated;
GRANT ALL ON public.google_maps_uso_mensal TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.google_maps_uso_mensal_id_seq TO service_role;

ALTER TABLE public.google_maps_uso_mensal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view usage"
  ON public.google_maps_uso_mensal FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can update usage limits"
  ON public.google_maps_uso_mensal FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_gm_uso_mensal_updated
  BEFORE UPDATE ON public.google_maps_uso_mensal
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.gm_mes_atual()
RETURNS DATE
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo'))::date;
$$;

CREATE OR REPLACE FUNCTION public.gm_incrementar_uso(qtd INTEGER DEFAULT 1)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  novo_total INTEGER;
BEGIN
  INSERT INTO public.google_maps_uso_mensal (mes_referencia, total_consultas)
  VALUES (public.gm_mes_atual(), qtd)
  ON CONFLICT (mes_referencia)
  DO UPDATE SET total_consultas = public.google_maps_uso_mensal.total_consultas + EXCLUDED.total_consultas,
                updated_at = now()
  RETURNING total_consultas INTO novo_total;
  RETURN novo_total;
END;
$$;

CREATE OR REPLACE FUNCTION public.gm_status_uso()
RETURNS TABLE (
  mes_referencia DATE,
  total_consultas INTEGER,
  limite_maximo INTEGER,
  limite_bloqueio INTEGER,
  alerta_percentual INTEGER,
  pode_buscar BOOLEAN,
  percentual_consumido NUMERIC,
  data_reset DATE,
  nivel TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mes DATE := public.gm_mes_atual();
  r public.google_maps_uso_mensal%ROWTYPE;
  pct NUMERIC;
  lvl TEXT;
BEGIN
  SELECT * INTO r FROM public.google_maps_uso_mensal WHERE public.google_maps_uso_mensal.mes_referencia = mes;
  IF NOT FOUND THEN
    INSERT INTO public.google_maps_uso_mensal (mes_referencia) VALUES (mes)
    RETURNING * INTO r;
  END IF;
  pct := ROUND((r.total_consultas::NUMERIC / NULLIF(r.limite_maximo,0)) * 100, 2);
  IF r.total_consultas >= r.limite_bloqueio THEN lvl := 'bloqueado';
  ELSIF pct >= 95 THEN lvl := 'critico';
  ELSIF pct >= r.alerta_percentual THEN lvl := 'alto';
  ELSE lvl := 'normal';
  END IF;
  RETURN QUERY SELECT
    r.mes_referencia,
    r.total_consultas,
    r.limite_maximo,
    r.limite_bloqueio,
    r.alerta_percentual,
    (r.total_consultas < r.limite_bloqueio),
    pct,
    (r.mes_referencia + INTERVAL '1 month')::date,
    lvl;
END;
$$;

GRANT EXECUTE ON FUNCTION public.gm_incrementar_uso(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.gm_status_uso() TO authenticated, service_role;
