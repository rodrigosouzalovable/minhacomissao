CREATE OR REPLACE FUNCTION public.certificado_redistribuir_pendentes_job(p_job_id uuid)
RETURNS TABLE(instancia_id uuid, quantidade integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Execução permitida somente ao serviço interno';
  END IF;

  PERFORM 1 FROM public.envio_meta_job WHERE id = p_job_id FOR UPDATE;

  RETURN QUERY
  WITH aptas AS (
    SELECT
      i.id,
      i.meta_bm_id,
      least(50, greatest(0, coalesce(i.certificado_limite_diario, 50))) AS limite,
      row_number() OVER (ORDER BY i.id) AS ordem_instancia
    FROM public.meta_whatsapp_instances i
    WHERE i.provider = 'meta'
      AND i.ativo IS TRUE
      AND i.instancia_teste_aquecimento IS FALSE
      AND i.aquecimento_meta_ativo IS TRUE
      AND i.meta_bm_id IS NOT NULL
      AND i.estado_pool = 'ativo'
      AND i.pool_fora_manual IS FALSE
      AND upper(coalesce(i.saude_status, '')) = 'CONNECTED'
      AND upper(coalesce(i.saude_quality, 'UNKNOWN')) IN ('GREEN', 'UNKNOWN', '')
      AND i.saude_ban_info IS NULL
      AND (i.pausa_automatica_ate IS NULL OR i.pausa_automatica_ate <= now())
      AND EXISTS (
        SELECT 1 FROM public.meta_whatsapp_templates t
        WHERE t.instancia_id = i.id
          AND t.nome_template = 'cnpj_atualizado_2'
          AND t.idioma = 'pt_BR'
          AND t.status = 'approved'
      )
  ), consumidos AS (
    SELECT a.id, a.meta_bm_id, a.limite, a.ordem_instancia,
      count(e.id) FILTER (
        WHERE e.reservado_em >= (date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo')
          AND e.status IN ('enviado', 'entregue', 'lido', 'respondido')
      )::integer AS usados
    FROM aptas a
    LEFT JOIN public.certificado_prospeccao_envios e ON e.instancia_id = a.id
    GROUP BY a.id, a.meta_bm_id, a.limite, a.ordem_instancia
  ), slots AS (
    SELECT c.id AS nova_instancia_id, c.meta_bm_id, s.rodada, c.ordem_instancia
    FROM consumidos c
    CROSS JOIN LATERAL generate_series(1, greatest(0, c.limite - c.usados)) AS s(rodada)
  ), slots_ordenados AS (
    SELECT *, row_number() OVER (ORDER BY rodada, ordem_instancia) AS rn
    FROM slots
  ), pendentes AS (
    SELECT ji.id AS item_id, e.id AS envio_id,
      row_number() OVER (ORDER BY ji.ordem) AS rn
    FROM public.envio_meta_job_item ji
    JOIN public.certificado_prospeccao_envios e
      ON e.id = nullif(ji.vars->>'certificado_envio_id', '')::uuid
    WHERE ji.job_id = p_job_id
      AND ji.status = 'pendente'
      AND e.status = 'reservado'
      AND coalesce(ji.vars->>'certificado_tipo_oferta', '') = 'renovacao_anual'
  ), atribuicoes AS (
    SELECT p.item_id, p.envio_id, s.nova_instancia_id, s.meta_bm_id
    FROM pendentes p
    JOIN slots_ordenados s USING (rn)
  ), envios AS (
    UPDATE public.certificado_prospeccao_envios e
    SET instancia_id = a.nova_instancia_id,
        bm_id = a.meta_bm_id,
        updated_at = now()
    FROM atribuicoes a
    WHERE e.id = a.envio_id
    RETURNING a.item_id, a.nova_instancia_id
  ), itens AS (
    UPDATE public.envio_meta_job_item ji
    SET vars = jsonb_set(ji.vars, '{certificado_instancia_id}', to_jsonb(e.nova_instancia_id::text), true),
        instancia_id = NULL,
        instancia_nome = NULL,
        updated_at = now()
    FROM envios e
    WHERE ji.id = e.item_id
    RETURNING e.nova_instancia_id
  )
  SELECT i.nova_instancia_id, count(*)::integer
  FROM itens i
  GROUP BY i.nova_instancia_id;
END;
$$;

REVOKE ALL ON FUNCTION public.certificado_redistribuir_pendentes_job(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.certificado_redistribuir_pendentes_job(uuid) TO service_role;