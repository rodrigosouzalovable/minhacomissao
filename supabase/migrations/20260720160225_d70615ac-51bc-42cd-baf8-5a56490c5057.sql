CREATE OR REPLACE FUNCTION public.acordos_block_duplicate_cpf()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_nome_funcionario TEXT;
  v_data_acordo TEXT;
  v_nao_quebrados INT;
BEGIN
  IF NEW.cliente_cpf IS NULL OR cpf_normalize(NEW.cliente_cpf) = '' THEN
    RETURN NEW;
  END IF;

  -- Admin sempre pode lançar
  IF is_admin_user(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Conta acordos anteriores com status diferente de 'quebrado'
  SELECT COUNT(*) INTO v_nao_quebrados
  FROM acordos
  WHERE cpf_normalize(cliente_cpf) = cpf_normalize(NEW.cliente_cpf)
    AND id IS DISTINCT FROM NEW.id
    AND COALESCE(status, '') <> 'quebrado';

  -- Se não há acordos ativos/finalizados, permite (inclui caso sem histórico e caso só com quebrados)
  IF v_nao_quebrados = 0 THEN
    RETURN NEW;
  END IF;

  -- Bloqueia: existe acordo não-quebrado
  SELECT p.nome,
         to_char(a.criado_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY')
    INTO v_nome_funcionario, v_data_acordo
  FROM acordos a
  JOIN profiles p ON p.id = a.user_id
  WHERE cpf_normalize(a.cliente_cpf) = cpf_normalize(NEW.cliente_cpf)
    AND a.id IS DISTINCT FROM NEW.id
    AND COALESCE(a.status, '') <> 'quebrado'
  ORDER BY a.criado_em DESC
  LIMIT 1;

  RAISE EXCEPTION 'Este CPF já possui acordo ativo/finalizado lançado por % em %. Apenas o administrador pode lançar. (Exceção: se todos os acordos anteriores estiverem quebrados, o lançamento é permitido.)',
    COALESCE(v_nome_funcionario, 'outro funcionário'),
    COALESCE(v_data_acordo, 'data desconhecida');
END;
$function$;