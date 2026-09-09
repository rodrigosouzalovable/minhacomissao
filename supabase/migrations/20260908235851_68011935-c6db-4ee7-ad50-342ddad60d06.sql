ALTER TABLE public.google_maps_leads
  ADD COLUMN IF NOT EXISTS instagram_url text,
  ADD COLUMN IF NOT EXISTS instagram_username text,
  ADD COLUMN IF NOT EXISTS instagram_seguidores integer,
  ADD COLUMN IF NOT EXISTS instagram_site text,
  ADD COLUMN IF NOT EXISTS instagram_atualizado_em timestamptz;

CREATE TABLE IF NOT EXISTS public.instagram_perfil_cache (
  username text PRIMARY KEY,
  seguidores integer,
  site text,
  nome_completo text,
  biografia text,
  erro text,
  created_at timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.instagram_perfil_cache TO authenticated;
GRANT ALL ON public.instagram_perfil_cache TO service_role;
ALTER TABLE public.instagram_perfil_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leitura cache instagram para quem tem google maps leads" ON public.instagram_perfil_cache;
CREATE POLICY "leitura cache instagram para quem tem google maps leads"
ON public.instagram_perfil_cache
FOR SELECT
TO authenticated
USING (public.pode_google_maps_leads(auth.uid()));

CREATE TABLE IF NOT EXISTS public.apify_uso_mensal (
  mes_referencia date PRIMARY KEY,
  total_chamadas integer NOT NULL DEFAULT 0,
  limite integer NOT NULL DEFAULT 1000,
  alerta_percentual integer NOT NULL DEFAULT 80,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.apify_uso_mensal TO authenticated;
GRANT ALL ON public.apify_uso_mensal TO service_role;
ALTER TABLE public.apify_uso_mensal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leitura uso apify para quem tem google maps leads" ON public.apify_uso_mensal;
CREATE POLICY "leitura uso apify para quem tem google maps leads"
ON public.apify_uso_mensal
FOR SELECT
TO authenticated
USING (public.pode_google_maps_leads(auth.uid()));

DROP TRIGGER IF EXISTS trg_apify_uso_mensal_updated_at ON public.apify_uso_mensal;
CREATE TRIGGER trg_apify_uso_mensal_updated_at
BEFORE UPDATE ON public.apify_uso_mensal
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.apify_status_uso()
RETURNS TABLE (
  mes_referencia date,
  total_chamadas integer,
  limite integer,
  alerta_percentual integer,
  percentual_consumido numeric,
  pode_buscar boolean,
  nivel text,
  data_reset date
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mes date := date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo'))::date;
  v_row public.apify_uso_mensal;
  v_pct numeric;
BEGIN
  SELECT * INTO v_row FROM public.apify_uso_mensal WHERE public.apify_uso_mensal.mes_referencia = v_mes;
  IF NOT FOUND THEN
    v_row.mes_referencia := v_mes;
    v_row.total_chamadas := 0;
    v_row.limite := 1000;
    v_row.alerta_percentual := 80;
  END IF;

  v_pct := round((v_row.total_chamadas::numeric / GREATEST(v_row.limite, 1)) * 100, 2);

  RETURN QUERY SELECT
    v_row.mes_referencia,
    v_row.total_chamadas,
    v_row.limite,
    v_row.alerta_percentual,
    v_pct,
    (v_row.total_chamadas < v_row.limite),
    CASE
      WHEN v_row.total_chamadas >= v_row.limite THEN 'bloqueado'
      WHEN v_pct >= 95 THEN 'critico'
      WHEN v_pct >= v_row.alerta_percentual THEN 'alto'
      ELSE 'normal'
    END,
    (v_mes + interval '1 month')::date;
END;
$$;

CREATE OR REPLACE FUNCTION public.apify_incrementar_uso(_qtd integer DEFAULT 1)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mes date := date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo'))::date;
  v_total integer;
BEGIN
  INSERT INTO public.apify_uso_mensal (mes_referencia, total_chamadas)
  VALUES (v_mes, GREATEST(_qtd, 0))
  ON CONFLICT (mes_referencia)
  DO UPDATE SET total_chamadas = public.apify_uso_mensal.total_chamadas + GREATEST(_qtd, 0)
  RETURNING total_chamadas INTO v_total;
  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.apify_status_uso() FROM public;
GRANT EXECUTE ON FUNCTION public.apify_status_uso() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.apify_incrementar_uso(integer) FROM public;
GRANT EXECUTE ON FUNCTION public.apify_incrementar_uso(integer) TO service_role;