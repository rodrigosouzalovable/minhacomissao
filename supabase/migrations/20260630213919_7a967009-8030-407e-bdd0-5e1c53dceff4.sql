
-- 1) Tabela do plano diário
CREATE TABLE public.meta_envios_meta_diaria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  data date NOT NULL,
  meta_clientes_unicos integer NOT NULL DEFAULT 30,
  dia_numero integer NOT NULL DEFAULT 1,
  plano_inicio date NOT NULL DEFAULT CURRENT_DATE,
  plano_objetivo_unicos integer NOT NULL DEFAULT 1000,
  plano_dias integer NOT NULL DEFAULT 7,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, data)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_envios_meta_diaria TO authenticated;
GRANT ALL ON public.meta_envios_meta_diaria TO service_role;

ALTER TABLE public.meta_envios_meta_diaria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages own plano"
ON public.meta_envios_meta_diaria FOR ALL TO authenticated
USING (user_id = auth.uid() OR public.is_admin_user(auth.uid()))
WITH CHECK (user_id = auth.uid() OR public.is_admin_user(auth.uid()));

CREATE TRIGGER trg_meta_envios_meta_diaria_updated_at
BEFORE UPDATE ON public.meta_envios_meta_diaria
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Tabela da fila
CREATE TABLE public.meta_envios_fila (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nome text,
  telefone text NOT NULL,
  telefone_norm text,
  cpf text,
  valor numeric(14,2),
  atraso_dias integer,
  prioridade integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pendente',
  enviado_em timestamptz,
  instancia_id uuid,
  template_id uuid,
  cooldown_ate date,
  erro text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_meta_envios_fila_user_status_prio
  ON public.meta_envios_fila (user_id, status, prioridade DESC, created_at);
CREATE INDEX idx_meta_envios_fila_user_tel
  ON public.meta_envios_fila (user_id, telefone_norm);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_envios_fila TO authenticated;
GRANT ALL ON public.meta_envios_fila TO service_role;

ALTER TABLE public.meta_envios_fila ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages own fila"
ON public.meta_envios_fila FOR ALL TO authenticated
USING (user_id = auth.uid() OR public.is_admin_user(auth.uid()))
WITH CHECK (user_id = auth.uid() OR public.is_admin_user(auth.uid()));

CREATE TRIGGER trg_meta_envios_fila_updated_at
BEFORE UPDATE ON public.meta_envios_fila
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Função de resumo
CREATE OR REPLACE FUNCTION public.meta_envios_resumo(_uid uuid DEFAULT NULL, _ate date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := COALESCE(_uid, auth.uid());
  v_ate date := COALESCE(_ate, CURRENT_DATE);
  v_ini7 date := v_ate - 6;
  v_unicos_hoje int := 0;
  v_unicos_7d int := 0;
  v_enviadas_hoje int := 0;
  v_por_instancia jsonb := '[]'::jsonb;
  v_serie jsonb := '[]'::jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'não autenticado';
  END IF;

  SELECT count(DISTINCT telefone), count(*)
    INTO v_unicos_hoje, v_enviadas_hoje
  FROM public.meta_whatsapp_envios_log
  WHERE user_id = v_uid
    AND (status IS NULL OR status <> 'failed')
    AND enviado_em::date = v_ate;

  SELECT count(DISTINCT telefone) INTO v_unicos_7d
  FROM public.meta_whatsapp_envios_log
  WHERE user_id = v_uid
    AND (status IS NULL OR status <> 'failed')
    AND enviado_em::date BETWEEN v_ini7 AND v_ate;

  SELECT coalesce(jsonb_agg(t), '[]'::jsonb) INTO v_por_instancia
  FROM (
    SELECT i.id, i.nome, i.display_phone, i.tier_diario, i.enviados_hoje,
           i.saude_quality, i.saude_tier, i.ativo,
           coalesce(c.qtd, 0) AS qtd_hoje,
           coalesce(c.unicos, 0) AS unicos_hoje
    FROM public.meta_whatsapp_instances i
    LEFT JOIN (
      SELECT instancia_id, count(*) AS qtd, count(DISTINCT telefone) AS unicos
      FROM public.meta_whatsapp_envios_log
      WHERE user_id = v_uid
        AND (status IS NULL OR status <> 'failed')
        AND enviado_em::date = v_ate
      GROUP BY instancia_id
    ) c ON c.instancia_id = i.id
    WHERE i.user_id = v_uid
    ORDER BY i.nome
  ) t;

  SELECT coalesce(jsonb_agg(jsonb_build_object('data', d, 'unicos', u, 'total', q) ORDER BY d), '[]'::jsonb)
    INTO v_serie
  FROM (
    SELECT enviado_em::date AS d,
           count(DISTINCT telefone) AS u,
           count(*) AS q
    FROM public.meta_whatsapp_envios_log
    WHERE user_id = v_uid
      AND (status IS NULL OR status <> 'failed')
      AND enviado_em::date BETWEEN v_ini7 AND v_ate
    GROUP BY enviado_em::date
  ) s;

  RETURN jsonb_build_object(
    'unicos_hoje', v_unicos_hoje,
    'unicos_7d', v_unicos_7d,
    'enviadas_hoje', v_enviadas_hoje,
    'por_instancia', v_por_instancia,
    'serie_7d', v_serie
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.meta_envios_resumo(uuid, date) TO authenticated;
