CREATE OR REPLACE FUNCTION public.alterar_vencimento_parcela_global(
  p_pagamento_id uuid,
  p_nova_data date
)
RETURNS public.pagamentos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pagamento public.pagamentos%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Faça login para alterar o vencimento.' USING ERRCODE = '42501';
  END IF;

  IF p_nova_data IS NULL THEN
    RAISE EXCEPTION 'Informe uma data de vencimento válida.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_pagamento
  FROM public.pagamentos
  WHERE id = p_pagamento_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parcela não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  IF v_pagamento.status <> 'pendente' THEN
    RAISE EXCEPTION 'Só é possível alterar o vencimento de parcelas pendentes.' USING ERRCODE = '42501';
  END IF;

  PERFORM set_config('app.edicao_pagamento_global', 'sim', true);

  UPDATE public.pagamentos
  SET data_prevista = p_nova_data
  WHERE id = p_pagamento_id
  RETURNING * INTO v_pagamento;

  RETURN v_pagamento;
END;
$$;

CREATE OR REPLACE FUNCTION public.definir_pagamento_parcela_global(
  p_pagamento_id uuid,
  p_pago boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pagamento public.pagamentos%ROWTYPE;
  v_status_acordo text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Faça login para atualizar o pagamento.' USING ERRCODE = '42501';
  END IF;

  IF p_pago IS NULL THEN
    RAISE EXCEPTION 'Informe o estado do pagamento.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_pagamento
  FROM public.pagamentos
  WHERE id = p_pagamento_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parcela não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  PERFORM 1
  FROM public.acordos
  WHERE id = v_pagamento.acordo_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acordo não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  PERFORM set_config('app.edicao_pagamento_global', 'sim', true);

  UPDATE public.pagamentos
  SET status = CASE WHEN p_pago THEN 'pago' ELSE 'pendente' END,
      data_paga = CASE WHEN p_pago THEN (now() AT TIME ZONE 'America/Sao_Paulo')::date ELSE NULL END
  WHERE id = p_pagamento_id
  RETURNING * INTO v_pagamento;

  IF NOT EXISTS (
    SELECT 1 FROM public.pagamentos
    WHERE acordo_id = v_pagamento.acordo_id
      AND status <> 'pago'
  ) THEN
    UPDATE public.acordos
    SET status = 'concluido'
    WHERE id = v_pagamento.acordo_id;
  ELSE
    UPDATE public.acordos
    SET status = 'ativo'
    WHERE id = v_pagamento.acordo_id
      AND status = 'concluido';
  END IF;

  SELECT status INTO v_status_acordo
  FROM public.acordos
  WHERE id = v_pagamento.acordo_id;

  RETURN jsonb_build_object(
    'pagamento_id', v_pagamento.id,
    'status', v_pagamento.status,
    'data_paga', v_pagamento.data_paga,
    'acordo_id', v_pagamento.acordo_id,
    'status_acordo', v_status_acordo
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.proteger_edicao_parcela_proprietario()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_owner uuid;
BEGIN
  IF COALESCE(current_setting('app.edicao_pagamento_global', true), '') = 'sim' THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::public.app_role) THEN RETURN NEW; END IF;
  SELECT user_id INTO v_owner FROM public.acordos WHERE id = OLD.acordo_id;
  IF v_owner IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Somente o responsável pode editar parcelas deste acordo.' USING ERRCODE = '42501';
  END IF;
  IF NEW.acordo_id IS DISTINCT FROM OLD.acordo_id OR NEW.numero_parcela IS DISTINCT FROM OLD.numero_parcela
     OR (OLD.status = 'pago' AND NEW.data_prevista IS DISTINCT FROM OLD.data_prevista) THEN
    RAISE EXCEPTION 'Parcela paga não pode ter vencimento alterado.' USING ERRCODE = '42501';
  END IF;
  IF (to_jsonb(NEW) - 'status' - 'data_paga' - 'data_prevista') IS DISTINCT FROM
     (to_jsonb(OLD) - 'status' - 'data_paga' - 'data_prevista')
     AND COALESCE(current_setting('app.edicao_acordo_proprietario', true), '') <> 'sim' THEN
    RAISE EXCEPTION 'Use a edição autorizada para o valor da parcela.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.proteger_edicao_acordo_proprietario()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(current_setting('app.edicao_pagamento_global', true), '') = 'sim' THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::public.app_role) THEN RETURN NEW; END IF;
  IF OLD.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Somente o responsável pode editar este acordo.' USING ERRCODE = '42501';
  END IF;
  IF (to_jsonb(NEW) - 'atualizado_em' - 'status' - 'boleto_enviado' - 'duplicado_verificado' - 'whatsapp_opt_in' - 'whatsapp_opt_in_em' - 'whatsapp_opt_in_origem' - 'empresa') IS DISTINCT FROM
     (to_jsonb(OLD) - 'atualizado_em' - 'status' - 'boleto_enviado' - 'duplicado_verificado' - 'whatsapp_opt_in' - 'whatsapp_opt_in_em' - 'whatsapp_opt_in_origem' - 'empresa')
     AND COALESCE(current_setting('app.edicao_acordo_proprietario', true), '') <> 'sim' THEN
    RAISE EXCEPTION 'Campos restritos à administração ou à edição autorizada.' USING ERRCODE = '42501';
  END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.cliente_nome IS DISTINCT FROM OLD.cliente_nome
     OR NEW.cliente_cpf IS DISTINCT FROM OLD.cliente_cpf OR NEW.parcelas IS DISTINCT FROM OLD.parcelas
     OR NEW.data_primeiro_pagamento IS DISTINCT FROM OLD.data_primeiro_pagamento
     OR NEW.dias_atraso IS DISTINCT FROM OLD.dias_atraso
     OR NEW.percentual_comissao IS DISTINCT FROM OLD.percentual_comissao
     OR NEW.observacoes IS DISTINCT FROM OLD.observacoes
     OR NEW.instancia_negociacao_id IS DISTINCT FROM OLD.instancia_negociacao_id THEN
    RAISE EXCEPTION 'Campos restritos à administração.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE POLICY "Usuários autenticados podem ver acordos para pagamentos"
ON public.acordos
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Usuários autenticados podem ver parcelas para pagamentos"
ON public.pagamentos
FOR SELECT
TO authenticated
USING (true);

REVOKE ALL ON FUNCTION public.alterar_vencimento_parcela_global(uuid, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.definir_pagamento_parcela_global(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.alterar_vencimento_parcela_global(uuid, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.definir_pagamento_parcela_global(uuid, boolean) TO authenticated, service_role;