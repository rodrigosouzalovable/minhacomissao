CREATE OR REPLACE FUNCTION public.voltar_meta_instancia_pool_manual(p_instancia_id uuid)
RETURNS public.meta_whatsapp_instances
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_inst public.meta_whatsapp_instances;
  v_ban_text text;
  v_restricoes_text text;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem devolver instâncias ao pool';
  END IF;

  SELECT * INTO v_inst
  FROM public.meta_whatsapp_instances
  WHERE id = p_instancia_id AND ativo = true
  FOR UPDATE;

  IF v_inst.id IS NULL THEN
    RAISE EXCEPTION 'Instância ativa não encontrada';
  END IF;

  IF v_inst.pool_fora_manual IS NOT TRUE THEN
    RAISE EXCEPTION 'Esta instância não está fora do pool manualmente';
  END IF;

  v_ban_text := coalesce(v_inst.saude_ban_info::text, '');
  v_restricoes_text := upper(coalesce(v_inst.saude_restricoes::text, ''));

  IF upper(coalesce(v_inst.saude_status, '')) <> 'CONNECTED' THEN
    RAISE EXCEPTION 'A Meta não confirmou a instância como conectada';
  END IF;
  IF upper(coalesce(v_inst.saude_quality, '')) <> 'GREEN' THEN
    RAISE EXCEPTION 'A qualidade precisa estar GREEN para voltar ao pool';
  END IF;
  IF upper(coalesce(v_inst.meta_name_status, v_inst.saude_name_status, '')) <> 'APPROVED' THEN
    RAISE EXCEPTION 'O nome de exibição ainda não está aprovado pela Meta';
  END IF;
  IF v_ban_text NOT IN ('', '{}', 'null') THEN
    RAISE EXCEPTION 'A Meta ainda informa bloqueio ou banimento nesta instância';
  END IF;
  IF v_restricoes_text ~ '"CAN_SEND_MESSAGE"[[:space:]]*:[[:space:]]*"(BLOCKED|LIMITED|RESTRICTED)"' THEN
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

  UPDATE public.meta_whatsapp_instances
  SET pool_fora_manual = false,
      pool_fora_manual_em = NULL,
      pool_fora_manual_por = NULL,
      estado_pool = 'ativo',
      pausa_automatica_ate = NULL,
      pausa_automatica_motivo = NULL
  WHERE id = p_instancia_id
  RETURNING * INTO v_inst;

  RETURN v_inst;
END;
$$;

REVOKE ALL ON FUNCTION public.voltar_meta_instancia_pool_manual(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.voltar_meta_instancia_pool_manual(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.voltar_meta_instancia_pool_manual(uuid) TO service_role;