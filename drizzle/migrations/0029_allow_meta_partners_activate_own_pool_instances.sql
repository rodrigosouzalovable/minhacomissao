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
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida';
  END IF;

  v_is_admin := public.has_role(v_uid, 'admin'::public.app_role);
  v_is_partner := public.is_parceiro_meta(v_uid);

  IF NOT v_is_admin AND NOT v_is_partner THEN
    RAISE EXCEPTION 'Apenas administradores ou Parceiros Meta podem ativar instâncias no pool';
  END IF;

  SELECT * INTO v_inst
  FROM public.meta_whatsapp_instances
  WHERE id = p_instancia_id
    AND ativo = true
  FOR UPDATE;

  IF v_inst.id IS NULL THEN
    RAISE EXCEPTION 'Instância ativa não encontrada';
  END IF;

  IF NOT v_is_admin AND NOT public.parceiro_tem_instancia(v_uid, p_instancia_id) THEN
    RAISE EXCEPTION 'Esta instância não está vinculada ao seu usuário';
  END IF;

  IF v_inst.pool_fora_manual IS TRUE THEN
    RAISE EXCEPTION 'Esta instância foi retirada manualmente e somente um administrador pode devolvê-la ao pool';
  END IF;

  UPDATE public.meta_whatsapp_instances
  SET estado_pool = 'ativo',
      data_ativacao_api = CASE
        WHEN v_inst.data_ativacao_api IS NULL THEN (now() AT TIME ZONE 'America/Sao_Paulo')::date
        ELSE v_inst.data_ativacao_api
      END,
      fase_rampup = CASE
        WHEN v_inst.data_ativacao_api IS NULL THEN 'fase1'
        ELSE v_inst.fase_rampup
      END,
      pausa_automatica_ate = NULL,
      pausa_automatica_motivo = NULL,
      qualidade_liberada_manual = CASE
        WHEN v_inst.estado_pool IN ('pausado', 'restrita') THEN true
        ELSE v_inst.qualidade_liberada_manual
      END,
      qualidade_liberada_em = CASE
        WHEN v_inst.estado_pool IN ('pausado', 'restrita') THEN now()
        ELSE v_inst.qualidade_liberada_em
      END
  WHERE id = p_instancia_id
  RETURNING * INTO v_inst;

  RETURN v_inst;
END;
$$;

REVOKE ALL ON FUNCTION public.ativar_meta_instancia_pool(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ativar_meta_instancia_pool(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.ativar_meta_instancia_pool(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ativar_meta_instancia_pool(uuid) TO service_role;