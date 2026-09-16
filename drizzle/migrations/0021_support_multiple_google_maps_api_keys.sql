CREATE TABLE public.google_maps_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_conta TEXT,
  api_key TEXT,
  ordem_prioridade INTEGER NOT NULL DEFAULT 100 CHECK (ordem_prioridade > 0),
  ativa BOOLEAN NOT NULL DEFAULT TRUE,
  limite_maximo INTEGER NOT NULL DEFAULT 5000 CHECK (limite_maximo > 0),
  limite_bloqueio INTEGER NOT NULL DEFAULT 4800 CHECK (limite_bloqueio > 0 AND limite_bloqueio <= limite_maximo),
  indisponivel_mes DATE,
  legacy_slot TEXT UNIQUE CHECK (legacy_slot IS NULL OR legacy_slot IN ('principal', 'reserva')),
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.google_maps_api_keys TO service_role;

ALTER TABLE public.google_maps_api_keys ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.google_maps_uso_chave (
  mes_referencia DATE NOT NULL,
  chave_id UUID NOT NULL REFERENCES public.google_maps_api_keys(id) ON DELETE RESTRICT,
  total_consultas INTEGER NOT NULL DEFAULT 0 CHECK (total_consultas >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (mes_referencia, chave_id)
);

GRANT ALL ON public.google_maps_uso_chave TO service_role;

ALTER TABLE public.google_maps_uso_chave ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_google_maps_api_keys_selecao
  ON public.google_maps_api_keys (ativa, ordem_prioridade, created_at);

INSERT INTO public.google_maps_api_keys (
  api_key,
  ordem_prioridade,
  ativa,
  limite_maximo,
  limite_bloqueio,
  legacy_slot,
  updated_by,
  updated_at
)
SELECT NULLIF(BTRIM(c.api_key), ''), 1, TRUE, 5000, 4800, 'principal', c.updated_by, COALESCE(c.updated_at, now())
FROM public.google_maps_config c
WHERE c.id = 1 AND NULLIF(BTRIM(c.api_key), '') IS NOT NULL
ON CONFLICT (legacy_slot) DO NOTHING;

INSERT INTO public.google_maps_api_keys (
  api_key,
  ordem_prioridade,
  ativa,
  limite_maximo,
  limite_bloqueio,
  legacy_slot,
  updated_by,
  updated_at
)
SELECT NULLIF(BTRIM(c.api_key_reserva), ''), 2, TRUE, 5000, 4800, 'reserva', c.reserva_updated_by, COALESCE(c.reserva_updated_at, now())
FROM public.google_maps_config c
WHERE c.id = 1 AND NULLIF(BTRIM(c.api_key_reserva), '') IS NOT NULL
ON CONFLICT (legacy_slot) DO NOTHING;

INSERT INTO public.google_maps_uso_chave (mes_referencia, chave_id, total_consultas, created_at, updated_at)
SELECT u.mes_referencia, k.id, u.total_consultas, u.created_at, u.updated_at
FROM public.google_maps_uso_provedor u
JOIN public.google_maps_api_keys k ON k.legacy_slot = u.provedor
ON CONFLICT (mes_referencia, chave_id) DO UPDATE
SET total_consultas = GREATEST(public.google_maps_uso_chave.total_consultas, EXCLUDED.total_consultas),
    updated_at = GREATEST(public.google_maps_uso_chave.updated_at, EXCLUDED.updated_at);

CREATE OR REPLACE FUNCTION public.gm_incrementar_uso_chave(p_chave_id UUID, p_qtd INTEGER DEFAULT 1)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  novo_total INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.google_maps_api_keys k WHERE k.id = p_chave_id) THEN
    RAISE EXCEPTION 'chave Google Maps inválida';
  END IF;

  INSERT INTO public.google_maps_uso_chave AS uso (mes_referencia, chave_id, total_consultas)
  VALUES (public.gm_mes_atual(), p_chave_id, GREATEST(p_qtd, 0))
  ON CONFLICT (mes_referencia, chave_id)
  DO UPDATE SET total_consultas = uso.total_consultas + EXCLUDED.total_consultas,
                updated_at = now()
  RETURNING uso.total_consultas INTO novo_total;

  RETURN novo_total;
END;
$$;

GRANT EXECUTE ON FUNCTION public.gm_incrementar_uso_chave(UUID, INTEGER) TO service_role;

CREATE OR REPLACE FUNCTION public.gm_status_chaves()
RETURNS TABLE (
  chave_id UUID,
  email_conta TEXT,
  sufixo TEXT,
  ordem_prioridade INTEGER,
  total_consultas INTEGER,
  limite_maximo INTEGER,
  limite_bloqueio INTEGER,
  pode_buscar BOOLEAN,
  percentual_consumido NUMERIC,
  configurada BOOLEAN,
  ativa BOOLEAN,
  em_uso BOOLEAN,
  indisponivel_mes DATE,
  data_reset DATE,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH status AS (
    SELECT
      k.id AS chave_id,
      k.email_conta,
      CASE WHEN NULLIF(BTRIM(k.api_key), '') IS NULL THEN NULL ELSE RIGHT(BTRIM(k.api_key), 4) END AS sufixo,
      k.ordem_prioridade,
      COALESCE(u.total_consultas, 0)::INTEGER AS total_consultas,
      k.limite_maximo,
      k.limite_bloqueio,
      k.ativa
        AND NULLIF(BTRIM(k.api_key), '') IS NOT NULL
        AND COALESCE(u.total_consultas, 0) < k.limite_bloqueio
        AND k.indisponivel_mes IS DISTINCT FROM public.gm_mes_atual() AS pode_buscar,
      ROUND((COALESCE(u.total_consultas, 0)::NUMERIC / NULLIF(k.limite_maximo, 0)) * 100, 2) AS percentual_consumido,
      NULLIF(BTRIM(k.api_key), '') IS NOT NULL AS configurada,
      k.ativa,
      k.indisponivel_mes,
      (public.gm_mes_atual() + INTERVAL '1 month')::DATE AS data_reset,
      k.updated_at
    FROM public.google_maps_api_keys k
    LEFT JOIN public.google_maps_uso_chave u
      ON u.chave_id = k.id AND u.mes_referencia = public.gm_mes_atual()
  ), marcada AS (
    SELECT s.*,
      s.pode_buscar AND ROW_NUMBER() OVER (
        PARTITION BY s.pode_buscar
        ORDER BY s.ordem_prioridade, s.chave_id
      ) = 1 AS em_uso
    FROM status s
  )
  SELECT m.chave_id, m.email_conta, m.sufixo, m.ordem_prioridade,
         m.total_consultas, m.limite_maximo, m.limite_bloqueio,
         m.pode_buscar, m.percentual_consumido, m.configurada,
         m.ativa, m.em_uso, m.indisponivel_mes, m.data_reset, m.updated_at
  FROM marcada m
  ORDER BY m.ordem_prioridade, m.chave_id;
$$;

GRANT EXECUTE ON FUNCTION public.gm_status_chaves() TO service_role;