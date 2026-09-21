CREATE OR REPLACE FUNCTION public.ativar_meta_instancia_pool(p_instancia_id uuid)
RETURNS public.meta_whatsapp_instances
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_inst public.meta_whatsapp_instances;
  v_is_admin boolean := false;
  v_is_partner boolean := false;
  v_ban_text text;
  v_phone_can_send text;
  v_waba_can_send text;
  v_business_can_send text;
  v_phone_details text;
  v_limitacao_apenas_nome boolean := false;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sessão inválida'; END IF;
  v_is_admin := public.has_role(v_uid, 'admin'::public.app_role);
  v_is_partner := public.is_parceiro_meta(v_uid);
  IF NOT v_is_admin AND NOT v_is_partner THEN
    RAISE EXCEPTION 'Apenas administradores ou Parceiros Meta podem ativar instâncias no pool';
  END IF;

  SELECT * INTO v_inst FROM public.meta_whatsapp_instances
  WHERE id = p_instancia_id AND ativo = true FOR UPDATE;
  IF v_inst.id IS NULL THEN RAISE EXCEPTION 'Instância ativa não encontrada'; END IF;
  IF NOT v_is_admin AND NOT public.parceiro_tem_instancia(v_uid, p_instancia_id) THEN
    RAISE EXCEPTION 'Esta instância não está vinculada ao seu usuário';
  END IF;

  IF v_inst.pool_fora_manual IS TRUE THEN
    v_ban_text := coalesce(v_inst.saude_ban_info::text, '');
    v_phone_can_send := upper(coalesce(v_inst.saude_restricoes #>> '{phone_health,can_send_message}', ''));
    v_waba_can_send := upper(coalesce(v_inst.saude_restricoes #>> '{waba_health,can_send_message}', ''));
    SELECT upper(coalesce(string_agg(value #>> '{}', ' '), '')) INTO v_phone_details
    FROM jsonb_array_elements(coalesce(v_inst.saude_restricoes #> '{phone_health,entities}', '[]'::jsonb)) entity,
         jsonb_array_elements(coalesce(entity #> '{additional_info}', '[]'::jsonb)) value
    WHERE upper(coalesce(entity->>'entity_type', '')) = 'PHONE_NUMBER';
    v_limitacao_apenas_nome := v_phone_details ~ 'DISPLAY NAME|NOME DE EXIBIÇÃO';
    SELECT upper(coalesce(entity->>'can_send_message', '')) INTO v_business_can_send
    FROM jsonb_array_elements(coalesce(v_inst.saude_restricoes #> '{phone_health,entities}', '[]'::jsonb)) entity
    WHERE upper(coalesce(entity->>'entity_type', '')) = 'BUSINESS' LIMIT 1;

    IF upper(coalesce(v_inst.saude_status, '')) NOT IN ('CONNECTED', '') THEN
      RAISE EXCEPTION 'A Meta informa que a instância não está conectada';
    END IF;
    IF v_ban_text NOT IN ('', '{}', 'null') THEN
      RAISE EXCEPTION 'A Meta ainda informa bloqueio ou banimento nesta instância';
    END IF;
    IF coalesce(v_waba_can_send, '') IN ('BLOCKED', 'LIMITED', 'RESTRICTED')
       OR coalesce(v_business_can_send, '') IN ('BLOCKED', 'LIMITED', 'RESTRICTED') THEN
      RAISE EXCEPTION 'A Meta ainda informa bloqueio comercial nesta conta';
    END IF;
    IF coalesce(v_phone_can_send, '') IN ('BLOCKED', 'LIMITED', 'RESTRICTED')
       AND NOT v_limitacao_apenas_nome THEN
      RAISE EXCEPTION 'A Meta ainda informa limitação de envio nesta instância';
    END IF;
    IF v_inst.quarentena_ate IS NOT NULL AND v_inst.quarentena_ate > now() THEN
      RAISE EXCEPTION 'A instância ainda está em quarentena';
    END IF;
    IF v_inst.pausa_automatica_ate IS NOT NULL AND v_inst.pausa_automatica_ate > now() THEN
      RAISE EXCEPTION 'A instância ainda possui uma pausa ativa';
    END IF;
    IF lower(coalesce(v_inst.pausa_automatica_motivo, '')) LIKE '%account_violation%' THEN
      RAISE EXCEPTION 'A conta ainda possui uma violação ativa na Meta';
    END IF;
  END IF;

  UPDATE public.meta_whatsapp_instances
  SET pool_fora_manual = false, pool_fora_manual_em = NULL, pool_fora_manual_por = NULL,
      estado_pool = 'ativo',
      data_ativacao_api = CASE WHEN v_inst.data_ativacao_api IS NULL THEN (now() AT TIME ZONE 'America/Sao_Paulo')::date ELSE v_inst.data_ativacao_api END,
      fase_rampup = CASE WHEN v_inst.data_ativacao_api IS NULL THEN 'fase1' ELSE v_inst.fase_rampup END,
      pausa_automatica_ate = NULL, pausa_automatica_motivo = NULL,
      qualidade_liberada_manual = CASE WHEN v_inst.estado_pool IN ('pausado', 'restrita', 'fora_manual') THEN true ELSE v_inst.qualidade_liberada_manual END,
      qualidade_liberada_em = CASE WHEN v_inst.estado_pool IN ('pausado', 'restrita', 'fora_manual') THEN now() ELSE v_inst.qualidade_liberada_em END
  WHERE id = p_instancia_id RETURNING * INTO v_inst;
  RETURN v_inst;
END;
$$;
REVOKE ALL ON FUNCTION public.ativar_meta_instancia_pool(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ativar_meta_instancia_pool(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.ativar_meta_instancia_pool(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ativar_meta_instancia_pool(uuid) TO service_role;