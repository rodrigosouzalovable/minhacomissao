
-- ============================================
-- RELATÓRIO DE ACIONAMENTOS - tabela principal
-- ============================================
CREATE TABLE IF NOT EXISTS public.relatorio_acionamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE NOT NULL,
  hora TEXT NOT NULL,
  tentativas INTEGER NOT NULL DEFAULT 0,
  alo INTEGER NOT NULL DEFAULT 0,
  cpc INTEGER NOT NULL DEFAULT 0,
  cpca INTEGER NOT NULL DEFAULT 0,
  acordos_valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_por UUID,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (data, hora)
);

GRANT SELECT, INSERT, UPDATE ON public.relatorio_acionamentos TO authenticated;
GRANT ALL ON public.relatorio_acionamentos TO service_role;

ALTER TABLE public.relatorio_acionamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ra_select_authenticated"
  ON public.relatorio_acionamentos FOR SELECT TO authenticated USING (true);

CREATE POLICY "ra_admin_all"
  ON public.relatorio_acionamentos FOR ALL TO authenticated
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

-- ============================================
-- LOG de auditoria
-- ============================================
CREATE TABLE IF NOT EXISTS public.relatorio_acionamentos_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID,
  acao TEXT NOT NULL,
  data DATE NOT NULL,
  hora TEXT,
  valor_anterior NUMERIC(12,2),
  valor_novo NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.relatorio_acionamentos_log TO authenticated;
GRANT ALL ON public.relatorio_acionamentos_log TO service_role;

ALTER TABLE public.relatorio_acionamentos_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ra_log_admin_select"
  ON public.relatorio_acionamentos_log FOR SELECT TO authenticated
  USING (public.is_admin_user(auth.uid()));

CREATE POLICY "ra_log_insert_authenticated"
  ON public.relatorio_acionamentos_log FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_ra_log_data ON public.relatorio_acionamentos_log(data);

-- ============================================
-- META diária
-- ============================================
CREATE TABLE IF NOT EXISTS public.relatorio_acionamentos_meta (
  data DATE PRIMARY KEY,
  meta_valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_por UUID
);

GRANT SELECT ON public.relatorio_acionamentos_meta TO authenticated;
GRANT ALL ON public.relatorio_acionamentos_meta TO service_role;

ALTER TABLE public.relatorio_acionamentos_meta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ra_meta_select_authenticated"
  ON public.relatorio_acionamentos_meta FOR SELECT TO authenticated USING (true);

CREATE POLICY "ra_meta_admin_all"
  ON public.relatorio_acionamentos_meta FOR ALL TO authenticated
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

-- ============================================
-- RPC: incrementar métrica com cooldown
-- ============================================
CREATE OR REPLACE FUNCTION public.incrementar_metrica_acionamento(
  p_data DATE,
  p_hora TEXT,
  p_coluna TEXT
) RETURNS public.relatorio_acionamentos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_last TIMESTAMPTZ;
  v_old INTEGER;
  v_row public.relatorio_acionamentos;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'não autenticado';
  END IF;

  IF p_coluna NOT IN ('tentativas','alo','cpc','cpca') THEN
    RAISE EXCEPTION 'coluna inválida: %', p_coluna;
  END IF;

  -- cooldown 2s por usuário/coluna/hora/data
  SELECT MAX(created_at) INTO v_last
  FROM public.relatorio_acionamentos_log
  WHERE usuario_id = v_uid
    AND data = p_data
    AND hora = p_hora
    AND acao = 'incremento_' || p_coluna;

  IF v_last IS NOT NULL AND (now() - v_last) < INTERVAL '2 seconds' THEN
    RAISE EXCEPTION 'cooldown ativo, aguarde 2s';
  END IF;

  INSERT INTO public.relatorio_acionamentos (data, hora, atualizado_por)
  VALUES (p_data, p_hora, v_uid)
  ON CONFLICT (data, hora) DO NOTHING;

  EXECUTE format(
    'UPDATE public.relatorio_acionamentos SET %I = %I + 1, atualizado_em = now(), atualizado_por = $1 WHERE data = $2 AND hora = $3 RETURNING *',
    p_coluna, p_coluna
  ) INTO v_row USING v_uid, p_data, p_hora;

  v_old := CASE p_coluna
    WHEN 'tentativas' THEN v_row.tentativas - 1
    WHEN 'alo' THEN v_row.alo - 1
    WHEN 'cpc' THEN v_row.cpc - 1
    WHEN 'cpca' THEN v_row.cpca - 1
  END;

  INSERT INTO public.relatorio_acionamentos_log
    (usuario_id, acao, data, hora, valor_anterior, valor_novo)
  VALUES (v_uid, 'incremento_' || p_coluna, p_data, p_hora, v_old, v_old + 1);

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.incrementar_metrica_acionamento(DATE, TEXT, TEXT) TO authenticated;

-- ============================================
-- TRIGGER: somar valor do acordo na faixa horária
-- ============================================
CREATE OR REPLACE FUNCTION public.relatorio_acionamentos_acordo_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_brt TIMESTAMPTZ;
  v_data DATE;
  v_hora_int INTEGER;
  v_faixa TEXT;
  v_old NUMERIC;
BEGIN
  v_brt := (NEW.criado_em AT TIME ZONE 'America/Sao_Paulo');
  v_data := v_brt::date;
  v_hora_int := EXTRACT(HOUR FROM v_brt)::int;

  IF v_hora_int < 8 OR v_hora_int > 18 THEN
    RETURN NEW;
  END IF;

  v_faixa := v_hora_int || 'h-' || (v_hora_int + 1) || 'h';

  INSERT INTO public.relatorio_acionamentos (data, hora, acordos_valor)
  VALUES (v_data, v_faixa, COALESCE(NEW.valor_total, 0))
  ON CONFLICT (data, hora) DO UPDATE
    SET acordos_valor = public.relatorio_acionamentos.acordos_valor + COALESCE(NEW.valor_total, 0),
        atualizado_em = now()
  RETURNING acordos_valor - COALESCE(NEW.valor_total, 0) INTO v_old;

  INSERT INTO public.relatorio_acionamentos_log
    (usuario_id, acao, data, hora, valor_anterior, valor_novo)
  VALUES (NEW.user_id, 'acordo_criado_auto', v_data, v_faixa, v_old, v_old + COALESCE(NEW.valor_total, 0));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ra_acordo ON public.acordos;
CREATE TRIGGER trg_ra_acordo
  AFTER INSERT ON public.acordos
  FOR EACH ROW EXECUTE FUNCTION public.relatorio_acionamentos_acordo_trigger();

-- ============================================
-- REALTIME
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.relatorio_acionamentos;
