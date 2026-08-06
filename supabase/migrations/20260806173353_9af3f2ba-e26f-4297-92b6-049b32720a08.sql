CREATE OR REPLACE FUNCTION public.delete_acordo_atomico(p_acordo_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_tem_pago boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'não autenticado';
  END IF;

  SELECT user_id INTO v_owner FROM acordos WHERE id = p_acordo_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'acordo não encontrado';
  END IF;

  IF NOT public.is_admin_user(v_uid) AND v_owner <> v_uid THEN
    RAISE EXCEPTION 'sem permissão para excluir este acordo';
  END IF;

  SELECT EXISTS(SELECT 1 FROM pagamentos WHERE acordo_id = p_acordo_id AND status = 'pago')
    INTO v_tem_pago;

  IF v_tem_pago THEN
    RAISE EXCEPTION 'Este acordo possui parcelas pagas e não pode ser excluído. Exclua apenas as parcelas pendentes.';
  END IF;

  DELETE FROM pagamentos WHERE acordo_id = p_acordo_id;
  DELETE FROM acordos WHERE id = p_acordo_id;
END;
$$;