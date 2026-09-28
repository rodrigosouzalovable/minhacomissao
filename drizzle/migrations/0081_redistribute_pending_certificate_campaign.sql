CREATE OR REPLACE FUNCTION public.certificado_redistribuir_pendentes_instancia(
  p_job_id uuid,
  p_instancia_id uuid,
  p_limite integer DEFAULT 50
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bm_id uuid;
  v_limite integer := least(50, greatest(0, coalesce(p_limite, 50)));
  v_usados integer := 0;
  v_transferir integer := 0;
  v_movidos integer := 0;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Execução permitida somente ao serviço interno';
  END IF;

  SELECT i.meta_bm_id INTO v_bm_id
  FROM public.meta_whatsapp_instances i
  WHERE i.id = p_instancia_id
    AND i.provider = 'meta'
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
  FOR UPDATE;

  IF v_bm_id IS NULL THEN RETURN 0; END IF;

  SELECT count(*) INTO v_usados
  FROM public.certificado_prospeccao_envios e
  WHERE e.instancia_id = p_instancia_id
    AND e.reservado_em >= (date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo')
    AND e.status IN ('reservado', 'enviado', 'entregue', 'lido', 'respondido');

  v_transferir := greatest(0, v_limite - v_usados);
  IF v_transferir = 0 THEN RETURN 0; END IF;

  WITH candidatos AS (
    SELECT ji.id AS item_id, e.id AS envio_id
    FROM public.envio_meta_job_item ji
    JOIN public.certificado_prospeccao_envios e
      ON e.id = nullif(ji.vars->>'certificado_envio_id', '')::uuid
    WHERE ji.job_id = p_job_id
      AND ji.status = 'pendente'
      AND e.status = 'reservado'
      AND coalesce(ji.vars->>'certificado_tipo_oferta', '') = 'renovacao_anual'
      AND coalesce(ji.vars->>'certificado_instancia_id', '') <> p_instancia_id::text
    ORDER BY ji.ordem DESC
    LIMIT v_transferir
    FOR UPDATE OF ji, e SKIP LOCKED
  ), envios AS (
    UPDATE public.certificado_prospeccao_envios e
    SET instancia_id = p_instancia_id, bm_id = v_bm_id, updated_at = now()
    FROM candidatos c
    WHERE e.id = c.envio_id
    RETURNING c.item_id
  )
  UPDATE public.envio_meta_job_item ji
  SET vars = jsonb_set(ji.vars, '{certificado_instancia_id}', to_jsonb(p_instancia_id::text), true),
      instancia_id = NULL,
      instancia_nome = NULL,
      updated_at = now()
  FROM envios x
  WHERE ji.id = x.item_id;

  GET DIAGNOSTICS v_movidos = ROW_COUNT;
  RETURN v_movidos;
END;
$$;

REVOKE ALL ON FUNCTION public.certificado_redistribuir_pendentes_instancia(uuid, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.certificado_redistribuir_pendentes_instancia(uuid, uuid, integer) TO service_role;