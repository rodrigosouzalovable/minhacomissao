CREATE TABLE public.google_maps_lead_atribuicoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.google_maps_leads(id) ON DELETE CASCADE,
  colaborador_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  atribuido_em timestamptz NOT NULL DEFAULT now(),
  dia date NOT NULL DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo')::date),
  contatado_em timestamptz,
  resultado text,
  retorno_em timestamptz,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT google_maps_lead_atribuicoes_lead_unique UNIQUE (lead_id),
  CONSTRAINT google_maps_lead_atribuicoes_resultado_check CHECK (resultado IS NULL OR resultado IN ('interessado', 'sem_interesse', 'nao_respondeu', 'retorno_agendado')),
  CONSTRAINT google_maps_lead_atribuicoes_retorno_check CHECK (resultado = 'retorno_agendado' OR retorno_em IS NULL)
);

GRANT SELECT ON public.google_maps_lead_atribuicoes TO authenticated;
GRANT ALL ON public.google_maps_lead_atribuicoes TO service_role;
ALTER TABLE public.google_maps_lead_atribuicoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gm_atribuicoes_proprias_select"
ON public.google_maps_lead_atribuicoes
FOR SELECT TO authenticated
USING (colaborador_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_gm_atribuicoes_colaborador_dia
ON public.google_maps_lead_atribuicoes (colaborador_id, dia DESC, atribuido_em DESC);

CREATE INDEX idx_gm_atribuicoes_resultado
ON public.google_maps_lead_atribuicoes (resultado, retorno_em)
WHERE resultado IS NOT NULL;

CREATE INDEX idx_gm_leads_prospeccao
ON public.google_maps_leads (tem_whatsapp, avaliacao DESC, total_avaliacoes DESC, created_at)
WHERE tem_whatsapp = true;

CREATE OR REPLACE FUNCTION public.gm_meus_leads_prospeccao()
RETURNS TABLE (
  atribuicao_id uuid,
  lead_id uuid,
  nome text,
  telefone text,
  telefone_internacional text,
  endereco text,
  categoria text,
  avaliacao numeric,
  total_avaliacoes integer,
  atribuido_em timestamptz,
  dia date,
  contatado_em timestamptz,
  resultado text,
  retorno_em timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id, l.id, l.nome, l.telefone, l.telefone_internacional,
         l.endereco, l.categoria, l.avaliacao, l.total_avaliacoes,
         a.atribuido_em, a.dia, a.contatado_em, a.resultado, a.retorno_em
  FROM public.google_maps_lead_atribuicoes a
  JOIN public.google_maps_leads l ON l.id = a.lead_id
  WHERE a.colaborador_id = auth.uid()
  ORDER BY a.dia DESC, a.atribuido_em DESC;
$$;

GRANT EXECUTE ON FUNCTION public.gm_meus_leads_prospeccao() TO authenticated;

CREATE OR REPLACE FUNCTION public.gm_atribuir_leads_diarios(_limite integer DEFAULT 10)
RETURNS TABLE (adicionados integer, total_hoje integer, estoque_restante integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_total integer;
  v_adicionados integer := 0;
  v_necessarios integer;
  v_lead record;
BEGIN
  IF v_uid IS NULL OR NOT public.pode_google_maps_leads(v_uid) THEN
    RAISE EXCEPTION 'Acesso não autorizado';
  END IF;
  IF public.has_role(v_uid, 'admin') OR public.is_parceiro_meta(v_uid) THEN
    RAISE EXCEPTION 'A lista diária é exclusiva para colaboradores';
  END IF;

  _limite := LEAST(GREATEST(COALESCE(_limite, 10), 1), 10);

  PERFORM pg_advisory_xact_lock(hashtext('gm-leads-diarios-' || v_uid::text));
  SELECT count(*) INTO v_total
  FROM public.google_maps_lead_atribuicoes
  WHERE colaborador_id = v_uid AND dia = v_hoje;

  v_necessarios := GREATEST(0, _limite - v_total);

  FOR v_lead IN
    SELECT l.id
    FROM public.google_maps_leads l
    WHERE l.tem_whatsapp = true
      AND (l.site IS NULL OR btrim(l.site) = '' OR lower(l.site) ~ '(instagram\.com|facebook\.com|fb\.com|linktr\.ee|linktree|wa\.me|api\.whatsapp\.com|linkedin\.com|tiktok\.com|youtube\.com|twitter\.com|x\.com|bit\.ly)')
      AND NOT EXISTS (SELECT 1 FROM public.google_maps_lead_atribuicoes a WHERE a.lead_id = l.id)
      AND NOT EXISTS (
        SELECT 1 FROM public.meta_destinatario_supressao s
        WHERE s.motivo LIKE 'blacklist%'
          AND s.telefone_sufixo = right(regexp_replace(COALESCE(l.telefone_internacional, l.telefone, ''), '\D', '', 'g'), 8)
      )
    ORDER BY
      CASE WHEN l.avaliacao >= 4.0 AND l.total_avaliacoes >= 10 THEN 0 ELSE 1 END,
      COALESCE(l.avaliacao, 0) DESC,
      COALESCE(l.total_avaliacoes, 0) DESC,
      CASE WHEN l.endereco IS NOT NULL AND l.categoria IS NOT NULL THEN 0 ELSE 1 END,
      l.created_at ASC
    FOR UPDATE OF l SKIP LOCKED
    LIMIT v_necessarios
  LOOP
    INSERT INTO public.google_maps_lead_atribuicoes (lead_id, colaborador_id, dia)
    VALUES (v_lead.id, v_uid, v_hoje)
    ON CONFLICT (lead_id) DO NOTHING;
    IF FOUND THEN v_adicionados := v_adicionados + 1; END IF;
  END LOOP;

  SELECT count(*) INTO v_total
  FROM public.google_maps_lead_atribuicoes
  WHERE colaborador_id = v_uid AND dia = v_hoje;

  RETURN QUERY SELECT v_adicionados, v_total, (
    SELECT count(*)::integer
    FROM public.google_maps_leads l
    WHERE l.tem_whatsapp = true
      AND (l.site IS NULL OR btrim(l.site) = '' OR lower(l.site) ~ '(instagram\.com|facebook\.com|fb\.com|linktr\.ee|linktree|wa\.me|api\.whatsapp\.com|linkedin\.com|tiktok\.com|youtube\.com|twitter\.com|x\.com|bit\.ly)')
      AND NOT EXISTS (SELECT 1 FROM public.google_maps_lead_atribuicoes a WHERE a.lead_id = l.id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.gm_atribuir_leads_diarios(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.gm_atualizar_contato_lead(
  _atribuicao_id uuid,
  _contatado boolean,
  _resultado text DEFAULT NULL,
  _retorno_em timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _resultado IS NOT NULL AND _resultado NOT IN ('interessado', 'sem_interesse', 'nao_respondeu', 'retorno_agendado') THEN
    RAISE EXCEPTION 'Resultado inválido';
  END IF;
  IF _resultado = 'retorno_agendado' AND _retorno_em IS NULL THEN
    RAISE EXCEPTION 'Informe a data do retorno';
  END IF;

  UPDATE public.google_maps_lead_atribuicoes
  SET contatado_em = CASE WHEN _contatado THEN COALESCE(contatado_em, now()) ELSE NULL END,
      resultado = CASE WHEN _contatado THEN _resultado ELSE NULL END,
      retorno_em = CASE WHEN _contatado AND _resultado = 'retorno_agendado' THEN _retorno_em ELSE NULL END,
      atualizado_em = now()
  WHERE id = _atribuicao_id AND colaborador_id = auth.uid();

  IF NOT FOUND THEN RAISE EXCEPTION 'Lead não encontrado ou sem permissão'; END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.gm_atualizar_contato_lead(uuid, boolean, text, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.gm_resumo_prospeccao_admin()
RETURNS TABLE (
  colaborador_id uuid,
  colaborador_nome text,
  entregues bigint,
  contatados bigint,
  interessados bigint,
  retornos bigint,
  sem_interesse bigint,
  nao_responderam bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.colaborador_id,
         COALESCE(p.nome, p.email, 'Colaborador') AS colaborador_nome,
         count(*) AS entregues,
         count(*) FILTER (WHERE a.contatado_em IS NOT NULL) AS contatados,
         count(*) FILTER (WHERE a.resultado = 'interessado') AS interessados,
         count(*) FILTER (WHERE a.resultado = 'retorno_agendado') AS retornos,
         count(*) FILTER (WHERE a.resultado = 'sem_interesse') AS sem_interesse,
         count(*) FILTER (WHERE a.resultado = 'nao_respondeu') AS nao_responderam
  FROM public.google_maps_lead_atribuicoes a
  LEFT JOIN public.profiles p ON p.id = a.colaborador_id
  WHERE public.has_role(auth.uid(), 'admin')
  GROUP BY a.colaborador_id, p.nome, p.email
  ORDER BY colaborador_nome;
$$;

GRANT EXECUTE ON FUNCTION public.gm_resumo_prospeccao_admin() TO authenticated;