
-- ============================================
-- Tabela: estrategia_importacao
-- ============================================
CREATE TABLE public.estrategia_importacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_arquivo text NOT NULL,
  total_cpfs integer NOT NULL DEFAULT 0,
  total_localizados integer NOT NULL DEFAULT 0,
  total_nao_localizados integer NOT NULL DEFAULT 0,
  total_acordos_quebrados integer NOT NULL DEFAULT 0,
  importado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estrategia_importacao TO authenticated;
GRANT ALL ON public.estrategia_importacao TO service_role;
ALTER TABLE public.estrategia_importacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos autenticados podem ver importações"
  ON public.estrategia_importacao FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins gerenciam importações"
  ON public.estrategia_importacao FOR ALL TO authenticated
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

-- ============================================
-- Tabela: estrategia_cliente
-- ============================================
CREATE TABLE public.estrategia_cliente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  importacao_id uuid NOT NULL REFERENCES public.estrategia_importacao(id) ON DELETE CASCADE,
  cpf text NOT NULL,
  nome text,
  telefone text,
  localizado boolean NOT NULL DEFAULT false,
  idade integer,
  credor text,
  tipo_credor text,
  contrato text,
  atraso_dias integer,
  risco_total numeric(14,2) DEFAULT 0,
  parcelas_abertas_qtd integer DEFAULT 0,
  proxima_parcela_num integer,
  proxima_parcela_valor numeric(14,2),
  proxima_parcela_vencimento date,
  valor_minimo_parcela numeric(14,2),
  valor_maximo_parcela numeric(14,2),
  acordo_quebrado boolean NOT NULL DEFAULT false,
  faixa_valor_parcela text,
  score integer NOT NULL DEFAULT 0,
  reservado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reservado_ate timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estrategia_cliente TO authenticated;
GRANT ALL ON public.estrategia_cliente TO service_role;
ALTER TABLE public.estrategia_cliente ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_estrat_cli_imp ON public.estrategia_cliente(importacao_id);
CREATE INDEX idx_estrat_cli_cpf ON public.estrategia_cliente(cpf);
CREATE INDEX idx_estrat_cli_score ON public.estrategia_cliente(score DESC);
CREATE INDEX idx_estrat_cli_reserva ON public.estrategia_cliente(reservado_por, reservado_ate);
CREATE INDEX idx_estrat_cli_filtros ON public.estrategia_cliente(localizado, faixa_valor_parcela, parcelas_abertas_qtd, score DESC);

CREATE POLICY "Admins veem tudo de estrategia_cliente"
  ON public.estrategia_cliente FOR SELECT TO authenticated
  USING (public.is_admin_user(auth.uid()));
CREATE POLICY "Funcionários veem CPFs que reservaram"
  ON public.estrategia_cliente FOR SELECT TO authenticated
  USING (reservado_por = auth.uid());
CREATE POLICY "Admins gerenciam estrategia_cliente"
  ON public.estrategia_cliente FOR ALL TO authenticated
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

-- ============================================
-- Tabela: estrategia_reserva_log
-- ============================================
CREATE TABLE public.estrategia_reserva_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  qtd integer NOT NULL,
  filtro jsonb,
  cpfs text[] NOT NULL DEFAULT '{}',
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.estrategia_reserva_log TO authenticated;
GRANT ALL ON public.estrategia_reserva_log TO service_role;
ALTER TABLE public.estrategia_reserva_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_estrat_log_user ON public.estrategia_reserva_log(user_id, criado_em DESC);

CREATE POLICY "Usuário vê seu próprio log"
  ON public.estrategia_reserva_log FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_user(auth.uid()));
CREATE POLICY "Usuário insere seu próprio log"
  ON public.estrategia_reserva_log FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- RPC: estrategia_reservar
-- ============================================
CREATE OR REPLACE FUNCTION public.estrategia_reservar(p_filtro jsonb, p_qtd integer)
RETURNS TABLE(
  cpf text, nome text, telefone text, localizado boolean,
  credor text, tipo_credor text, contrato text,
  atraso_dias integer, parcelas_abertas_qtd integer,
  proxima_parcela_num integer, proxima_parcela_valor numeric,
  proxima_parcela_vencimento date, faixa_valor_parcela text,
  acordo_quebrado boolean, score integer
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_imp uuid;
  v_ids uuid[];
  v_faixas text[];
  v_parc_min integer;
  v_parc_max integer;
  v_localizado text;
  v_quebrado text;
  v_tipo text;
  v_atraso_min integer;
  v_atraso_max integer;
  v_order text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'não autenticado';
  END IF;
  IF p_qtd IS NULL OR p_qtd < 1 OR p_qtd > 500 THEN
    RAISE EXCEPTION 'quantidade inválida';
  END IF;

  SELECT id INTO v_imp FROM estrategia_importacao
    WHERE ativo = true ORDER BY criado_em DESC LIMIT 1;
  IF v_imp IS NULL THEN
    RAISE EXCEPTION 'Nenhuma importação ativa. Importe a planilha primeiro.';
  END IF;

  v_faixas := CASE WHEN p_filtro ? 'faixas' THEN
    ARRAY(SELECT jsonb_array_elements_text(p_filtro->'faixas'))
    ELSE NULL END;
  v_parc_min := NULLIF(p_filtro->>'parcelas_min','')::int;
  v_parc_max := NULLIF(p_filtro->>'parcelas_max','')::int;
  v_localizado := p_filtro->>'localizado';
  v_quebrado := p_filtro->>'acordo_quebrado';
  v_tipo := p_filtro->>'tipo_credor';
  v_atraso_min := NULLIF(p_filtro->>'atraso_min','')::int;
  v_atraso_max := NULLIF(p_filtro->>'atraso_max','')::int;
  v_order := COALESCE(p_filtro->>'ordem','score');

  SELECT array_agg(id) INTO v_ids FROM (
    SELECT ec.id FROM estrategia_cliente ec
    WHERE ec.importacao_id = v_imp
      AND (ec.reservado_ate IS NULL OR ec.reservado_ate < now() OR ec.reservado_por = v_uid)
      AND (v_faixas IS NULL OR ec.faixa_valor_parcela = ANY(v_faixas))
      AND (v_parc_min IS NULL OR ec.parcelas_abertas_qtd >= v_parc_min)
      AND (v_parc_max IS NULL OR ec.parcelas_abertas_qtd <= v_parc_max)
      AND (v_localizado IS NULL OR v_localizado = '' OR
           (v_localizado = 'sim' AND ec.localizado = true) OR
           (v_localizado = 'nao' AND ec.localizado = false))
      AND (v_quebrado IS NULL OR v_quebrado = '' OR
           (v_quebrado = 'sim' AND ec.acordo_quebrado = true) OR
           (v_quebrado = 'nao' AND ec.acordo_quebrado = false))
      AND (v_tipo IS NULL OR v_tipo = '' OR ec.tipo_credor = v_tipo)
      AND (v_atraso_min IS NULL OR ec.atraso_dias >= v_atraso_min)
      AND (v_atraso_max IS NULL OR ec.atraso_dias <= v_atraso_max)
    ORDER BY
      CASE WHEN v_order = 'valor' THEN ec.proxima_parcela_valor END DESC NULLS LAST,
      CASE WHEN v_order = 'atraso' THEN ec.atraso_dias END ASC NULLS LAST,
      ec.score DESC, ec.proxima_parcela_valor DESC NULLS LAST
    LIMIT p_qtd
  ) t;

  IF v_ids IS NULL OR array_length(v_ids,1) IS NULL THEN
    RETURN;
  END IF;

  UPDATE estrategia_cliente
    SET reservado_por = v_uid, reservado_ate = now() + interval '48 hours'
    WHERE id = ANY(v_ids);

  INSERT INTO estrategia_reserva_log (user_id, qtd, filtro, cpfs)
  VALUES (v_uid, array_length(v_ids,1), p_filtro,
    (SELECT array_agg(ec.cpf) FROM estrategia_cliente ec WHERE ec.id = ANY(v_ids)));

  RETURN QUERY
  SELECT ec.cpf, ec.nome, ec.telefone, ec.localizado,
         ec.credor, ec.tipo_credor, ec.contrato,
         ec.atraso_dias, ec.parcelas_abertas_qtd,
         ec.proxima_parcela_num, ec.proxima_parcela_valor,
         ec.proxima_parcela_vencimento, ec.faixa_valor_parcela,
         ec.acordo_quebrado, ec.score
  FROM estrategia_cliente ec
  WHERE ec.id = ANY(v_ids)
  ORDER BY ec.score DESC;
END;
$$;

-- ============================================
-- RPC: estrategia_liberar_reserva_admin
-- ============================================
CREATE OR REPLACE FUNCTION public.estrategia_liberar_reservas(p_user_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_count integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'não autenticado'; END IF;

  IF p_user_id IS NULL THEN
    IF NOT public.is_admin_user(v_uid) THEN
      RAISE EXCEPTION 'apenas admin pode liberar tudo';
    END IF;
    UPDATE estrategia_cliente SET reservado_por = NULL, reservado_ate = NULL
      WHERE reservado_ate IS NOT NULL;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  ELSE
    IF p_user_id <> v_uid AND NOT public.is_admin_user(v_uid) THEN
      RAISE EXCEPTION 'sem permissão';
    END IF;
    UPDATE estrategia_cliente SET reservado_por = NULL, reservado_ate = NULL
      WHERE reservado_por = p_user_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;
  RETURN v_count;
END;
$$;

-- ============================================
-- RPC: estrategia_resumo (contagens para cards)
-- ============================================
CREATE OR REPLACE FUNCTION public.estrategia_resumo()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_imp uuid;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'não autenticado'; END IF;
  SELECT id INTO v_imp FROM estrategia_importacao
    WHERE ativo = true ORDER BY criado_em DESC LIMIT 1;
  IF v_imp IS NULL THEN RETURN '{}'::jsonb; END IF;

  RETURN jsonb_build_object(
    'importacao_id', v_imp,
    'total', (SELECT count(*) FROM estrategia_cliente WHERE importacao_id = v_imp),
    'disponiveis', (SELECT count(*) FROM estrategia_cliente WHERE importacao_id = v_imp AND (reservado_ate IS NULL OR reservado_ate < now())),
    'localizados', (SELECT count(*) FROM estrategia_cliente WHERE importacao_id = v_imp AND localizado = true AND (reservado_ate IS NULL OR reservado_ate < now())),
    'uma_parcela_loc', (SELECT count(*) FROM estrategia_cliente WHERE importacao_id = v_imp AND localizado = true AND parcelas_abertas_qtd = 1 AND (reservado_ate IS NULL OR reservado_ate < now())),
    'ticket_alto_loc', (SELECT count(*) FROM estrategia_cliente WHERE importacao_id = v_imp AND localizado = true AND faixa_valor_parcela = '500+' AND (reservado_ate IS NULL OR reservado_ate < now())),
    'quebrados_loc', (SELECT count(*) FROM estrategia_cliente WHERE importacao_id = v_imp AND localizado = true AND acordo_quebrado = true AND (reservado_ate IS NULL OR reservado_ate < now())),
    'aporte_loc', (SELECT count(*) FROM estrategia_cliente WHERE importacao_id = v_imp AND localizado = true AND tipo_credor = 'APORTE' AND (reservado_ate IS NULL OR reservado_ate < now())),
    'janela_quente_loc', (SELECT count(*) FROM estrategia_cliente WHERE importacao_id = v_imp AND localizado = true AND atraso_dias BETWEEN 60 AND 180 AND (reservado_ate IS NULL OR reservado_ate < now()))
  );
END;
$$;
