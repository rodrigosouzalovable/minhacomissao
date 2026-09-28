ALTER TABLE public.meta_whatsapp_instances
  ADD COLUMN IF NOT EXISTS certificado_limite_diario integer NOT NULL DEFAULT 50;

ALTER TABLE public.meta_whatsapp_instances
  ADD CONSTRAINT meta_whatsapp_instances_certificado_limite_diario_check
  CHECK (certificado_limite_diario BETWEEN 1 AND 500);

COMMENT ON COLUMN public.meta_whatsapp_instances.certificado_limite_diario IS
  'Meta diária individual de reservas para prospecção do Certificado Digital pela Casa dos Dados.';

CREATE OR REPLACE FUNCTION public.proteger_config_certificado_instancia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (OLD.aquecimento_meta_ativo IS DISTINCT FROM NEW.aquecimento_meta_ativo
      OR OLD.certificado_limite_diario IS DISTINCT FROM NEW.certificado_limite_diario)
     AND auth.uid() IS NOT NULL
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar o aquecimento do Certificado';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS proteger_config_certificado_instancia_trigger ON public.meta_whatsapp_instances;
CREATE TRIGGER proteger_config_certificado_instancia_trigger
BEFORE UPDATE OF aquecimento_meta_ativo, certificado_limite_diario
ON public.meta_whatsapp_instances
FOR EACH ROW
EXECUTE FUNCTION public.proteger_config_certificado_instancia();

CREATE OR REPLACE FUNCTION public.certificado_reservar_lote_instancia(
  p_instancia_id uuid,
  p_limite integer,
  p_bm_id uuid,
  p_template_nome text,
  p_template_idioma text,
  p_job_id uuid,
  p_candidatos jsonb
)
RETURNS TABLE(id uuid, lead_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
      (item->>'id')::uuid AS reserva_id,
      (item->>'lead_id')::uuid AS candidato_lead_id,
      ord
    FROM jsonb_array_elements(p_candidatos) WITH ORDINALITY AS c(item, ord)
    WHERE item ? 'id' AND item ? 'lead_id'
    ORDER BY ord
    LIMIT v_saldo
  ), inseridos AS (
    INSERT INTO public.certificado_prospeccao_envios
      (id, lead_id, bm_id, instancia_id, template_nome, template_idioma, job_id)
    SELECT reserva_id, candidato_lead_id, p_bm_id, p_instancia_id, p_template_nome, p_template_idioma, p_job_id
    FROM candidatos
    ON CONFLICT (lead_id) DO NOTHING
    RETURNING certificado_prospeccao_envios.id, certificado_prospeccao_envios.lead_id
  )
  SELECT inseridos.id, inseridos.lead_id FROM inseridos;
END;
$$;

REVOKE ALL ON FUNCTION public.certificado_reservar_lote_instancia(uuid, integer, uuid, text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.certificado_reservar_lote_instancia(uuid, integer, uuid, text, text, uuid, jsonb) TO service_role;