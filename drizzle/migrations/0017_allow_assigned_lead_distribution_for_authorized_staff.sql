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
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_permissions up
    WHERE up.user_id = v_uid
      AND up.abas_permitidas IS NOT NULL
      AND '/admin/google-maps-leads' = ANY(up.abas_permitidas)
  ) THEN
    RAISE EXCEPTION 'Acesso não autorizado';
  END IF;
  IF public.has_role(v_uid, 'admin') OR public.is_parceiro_meta(v_uid) THEN
    RAISE EXCEPTION 'A lista diária é exclusiva para colaboradores';
  END IF;

  _limite := LEAST(GREATEST(COALESCE(_limite, 10), 1), 10);
  PERFORM pg_advisory_xact_lock(hashtext('gm-leads-diarios-' || v_uid::text));

  SELECT count(*) INTO v_total FROM public.google_maps_lead_atribuicoes
  WHERE colaborador_id = v_uid AND dia = v_hoje;
  v_necessarios := GREATEST(0, _limite - v_total);

  FOR v_lead IN
    SELECT l.id FROM public.google_maps_leads l
    WHERE l.tem_whatsapp = true
      AND (l.site IS NULL OR btrim(l.site) = '' OR lower(l.site) ~ '(instagram\.com|facebook\.com|fb\.com|linktr\.ee|linktree|wa\.me|api\.whatsapp\.com|linkedin\.com|tiktok\.com|youtube\.com|twitter\.com|x\.com|bit\.ly)')
      AND NOT EXISTS (SELECT 1 FROM public.google_maps_lead_atribuicoes a WHERE a.lead_id = l.id)
      AND NOT EXISTS (
        SELECT 1 FROM public.meta_destinatario_supressao s
        WHERE s.motivo LIKE 'blacklist%'
          AND s.telefone_sufixo = right(regexp_replace(COALESCE(l.telefone_internacional, l.telefone, ''), '\D', '', 'g'), 8)
      )
    ORDER BY CASE WHEN l.avaliacao >= 4.0 AND l.total_avaliacoes >= 10 THEN 0 ELSE 1 END,
      COALESCE(l.avaliacao, 0) DESC, COALESCE(l.total_avaliacoes, 0) DESC,
      CASE WHEN l.endereco IS NOT NULL AND l.categoria IS NOT NULL THEN 0 ELSE 1 END, l.created_at ASC
    FOR UPDATE OF l SKIP LOCKED LIMIT v_necessarios
  LOOP
    INSERT INTO public.google_maps_lead_atribuicoes (lead_id, colaborador_id, dia)
    VALUES (v_lead.id, v_uid, v_hoje) ON CONFLICT (lead_id) DO NOTHING;
    IF FOUND THEN v_adicionados := v_adicionados + 1; END IF;
  END LOOP;

  SELECT count(*) INTO v_total FROM public.google_maps_lead_atribuicoes
  WHERE colaborador_id = v_uid AND dia = v_hoje;

  RETURN QUERY SELECT v_adicionados, v_total, (
    SELECT count(*)::integer FROM public.google_maps_leads l
    WHERE l.tem_whatsapp = true
      AND (l.site IS NULL OR btrim(l.site) = '' OR lower(l.site) ~ '(instagram\.com|facebook\.com|fb\.com|linktr\.ee|linktree|wa\.me|api\.whatsapp\.com|linkedin\.com|tiktok\.com|youtube\.com|twitter\.com|x\.com|bit\.ly)')
      AND NOT EXISTS (SELECT 1 FROM public.google_maps_lead_atribuicoes a WHERE a.lead_id = l.id)
  );
END;
$$;