-- 1. Add column
ALTER TABLE public.user_permissions
  ADD COLUMN IF NOT EXISTS pode_excluir_acordos boolean NOT NULL DEFAULT false;

-- 2. Update delete_acordo_atomico: allow admin OR owner with permission; block if any paid parcel
CREATE OR REPLACE FUNCTION public.delete_acordo_atomico(p_acordo_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_perm boolean;
  v_tem_pago boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'não autenticado';
  END IF;

  SELECT user_id INTO v_owner FROM acordos WHERE id = p_acordo_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'acordo não encontrado';
  END IF;

  IF NOT public.is_admin_user(v_uid) THEN
    SELECT COALESCE(pode_excluir_acordos, false) INTO v_perm
      FROM public.user_permissions WHERE user_id = v_uid;
    IF NOT COALESCE(v_perm, false) OR v_owner <> v_uid THEN
      RAISE EXCEPTION 'sem permissão para excluir este acordo';
    END IF;
  END IF;

  SELECT EXISTS(SELECT 1 FROM pagamentos WHERE acordo_id = p_acordo_id AND status = 'pago')
    INTO v_tem_pago;

  IF v_tem_pago THEN
    RAISE EXCEPTION 'Este acordo possui parcelas pagas e não pode ser excluído. Exclua apenas as parcelas pendentes.';
  END IF;

  DELETE FROM pagamentos WHERE acordo_id = p_acordo_id;
  DELETE FROM acordos WHERE id = p_acordo_id;
END;
$function$;

-- 3. New function to delete a single pending parcel
CREATE OR REPLACE FUNCTION public.excluir_parcela_pendente(p_pagamento_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_status text;
  v_acordo uuid;
  v_owner uuid;
  v_perm boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'não autenticado';
  END IF;

  SELECT status, acordo_id INTO v_status, v_acordo
    FROM pagamentos WHERE id = p_pagamento_id;
  IF v_acordo IS NULL THEN
    RAISE EXCEPTION 'parcela não encontrada';
  END IF;

  IF v_status = 'pago' THEN
    RAISE EXCEPTION 'Parcela paga não pode ser excluída.';
  END IF;

  SELECT user_id INTO v_owner FROM acordos WHERE id = v_acordo;

  IF NOT public.is_admin_user(v_uid) THEN
    SELECT COALESCE(pode_excluir_acordos, false) INTO v_perm
      FROM public.user_permissions WHERE user_id = v_uid;
    IF NOT COALESCE(v_perm, false) OR v_owner <> v_uid THEN
      RAISE EXCEPTION 'sem permissão para excluir esta parcela';
    END IF;
  END IF;

  DELETE FROM pagamentos WHERE id = p_pagamento_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.excluir_parcela_pendente(uuid) TO authenticated;

-- 4. Update trigger to allow users with permite_cpf_duplicado
CREATE OR REPLACE FUNCTION public.acordos_block_duplicate_cpf()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_nome_funcionario TEXT;
  v_data_acordo TEXT;
  v_perm boolean;
BEGIN
  IF NEW.cliente_cpf IS NULL OR cpf_normalize(NEW.cliente_cpf) = '' THEN
    RETURN NEW;
  END IF;

  IF is_admin_user(auth.uid()) THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(permite_cpf_duplicado, false) INTO v_perm
    FROM public.user_permissions WHERE user_id = auth.uid();
  IF COALESCE(v_perm, false) THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM acordos
    WHERE cpf_normalize(cliente_cpf) = cpf_normalize(NEW.cliente_cpf)
      AND id IS DISTINCT FROM NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  IF cpf_ultimo_acordo_quebrado(NEW.cliente_cpf) THEN
    RETURN NEW;
  END IF;

  SELECT p.nome,
         to_char(a.criado_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY')
    INTO v_nome_funcionario, v_data_acordo
  FROM acordos a
  JOIN profiles p ON p.id = a.user_id
  WHERE cpf_normalize(a.cliente_cpf) = cpf_normalize(NEW.cliente_cpf)
    AND a.id IS DISTINCT FROM NEW.id
  ORDER BY a.criado_em DESC
  LIMIT 1;

  RAISE EXCEPTION 'Este CPF já possui acordo lançado por % em %. Apenas o administrador pode lançar acordos duplicados.',
    COALESCE(v_nome_funcionario, 'outro funcionário'),
    COALESCE(v_data_acordo, 'data desconhecida');
END;
$function$;