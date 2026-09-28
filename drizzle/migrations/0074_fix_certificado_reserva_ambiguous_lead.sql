CREATE OR REPLACE FUNCTION public.certificado_reservar_lote_instancia(p_instancia_id uuid, p_limite integer, p_bm_id uuid, p_template_nome text, p_template_idioma text, p_job_id uuid, p_candidatos jsonb)
RETURNS TABLE(id uuid, lead_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_dia date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_inicio timestamptz := (v_dia::timestamp AT TIME ZONE 'America/Sao_Paulo');
  v_usados integer;
  v_saldo integer;
BEGIN
  IF p_limite < 1 OR p_limite > 500 THEN
    RAISE EXCEPTION 'Meta diária deve estar entre 1 e 500';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_instancia_id::text || ':' || v_dia::text, 0));

  SELECT count(*)::integer INTO v_usados
  FROM public.certificado_prospeccao_envios e
  WHERE e.instancia_id = p_instancia_id
    AND e.reservado_em >= v_inicio
    AND e.status IN ('reservado', 'enviado', 'entregue', 'lido', 'respondido');

  v_saldo := greatest(0, p_limite - v_usados);
  IF v_saldo = 0 THEN RETURN; END IF;

  RETURN QUERY
  WITH candidatos AS (
    SELECT
      (c.item->>'id')::uuid AS reserva_id,
      (c.item->>'lead_id')::uuid AS candidato_lead_id,
      c.ord
    FROM jsonb_array_elements(p_candidatos) WITH ORDINALITY AS c(item, ord)
    WHERE c.item ? 'id' AND c.item ? 'lead_id'
    ORDER BY c.ord
    LIMIT v_saldo
  ), inseridos AS (
    INSERT INTO public.certificado_prospeccao_envios AS e
      (id, lead_id, bm_id, instancia_id, template_nome, template_idioma, job_id)
    SELECT candidatos.reserva_id, candidatos.candidato_lead_id, p_bm_id, p_instancia_id, p_template_nome, p_template_idioma, p_job_id
    FROM candidatos
    ON CONFLICT (lead_id) DO NOTHING
    RETURNING e.id, e.lead_id
  )
  SELECT inseridos.id, inseridos.lead_id FROM inseridos;
END;
$function$;

REVOKE ALL ON FUNCTION public.certificado_reservar_lote_instancia(uuid, integer, uuid, text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.certificado_reservar_lote_instancia(uuid, integer, uuid, text, text, uuid, jsonb) TO service_role;