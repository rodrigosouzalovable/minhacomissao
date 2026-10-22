CREATE OR REPLACE FUNCTION public.editar_acordo_proprio_completo(
  p_acordo_id uuid, p_nome text, p_cpf text, p_telefone text, p_quantidade integer,
  p_parcelas jsonb DEFAULT '[]'::jsonb, p_novas jsonb DEFAULT '[]'::jsonb)
RETURNS public.acordos LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_acordo public.acordos%ROWTYPE;
  v_parcela public.pagamentos%ROWTYPE;
  v_item jsonb; v_id uuid; v_valor numeric; v_data date;
  v_total numeric; v_comissao numeric; v_count integer; v_pagas integer; v_max integer;
  v_cpf text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  v_tel text := nullif(trim(coalesce(p_telefone, '')), '');
  v_remover integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login para editar.' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_acordo FROM public.acordos WHERE id = p_acordo_id FOR UPDATE;
  IF NOT FOUND OR (v_acordo.user_id <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Você só pode editar seus próprios acordos.' USING ERRCODE = '42501';
  END IF;
  IF length(trim(coalesce(p_nome, ''))) < 3 OR length(p_nome) > 200 THEN
    RAISE EXCEPTION 'Nome do cliente inválido.' USING ERRCODE = '22023';
  END IF;
  IF length(v_cpf) <> 11 THEN RAISE EXCEPTION 'CPF deve ter 11 dígitos.' USING ERRCODE = '22023'; END IF;
  IF v_tel IS NOT NULL AND (length(v_tel) > 15 OR v_tel !~ '^[0-9 ()+.-]*$') THEN
    RAISE EXCEPTION 'Telefone inválido.' USING ERRCODE = '22023';
  END IF;
  IF p_quantidade IS NULL OR p_quantidade < 1 OR p_quantidade > 120 THEN
    RAISE EXCEPTION 'Quantidade de parcelas inválida.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_parcelas) <> 'array' OR jsonb_typeof(p_novas) <> 'array' THEN
    RAISE EXCEPTION 'Lista de parcelas inválida.' USING ERRCODE = '22023';
  END IF;

  IF cpf_normalize(v_cpf) IS DISTINCT FROM cpf_normalize(v_acordo.cliente_cpf)
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role)
     AND EXISTS (SELECT 1 FROM public.acordos a WHERE cpf_normalize(a.cliente_cpf) = cpf_normalize(v_cpf)
                 AND a.id <> p_acordo_id AND COALESCE(a.status, '') <> 'quebrado') THEN
    RAISE EXCEPTION 'Já existe acordo ativo para este CPF.' USING ERRCODE = '23505';
  END IF;

  PERFORM set_config('app.edicao_acordo_proprietario', 'sim', true);

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_parcelas) LOOP
    v_id := (v_item->>'id')::uuid; v_valor := (v_item->>'valor')::numeric; v_data := (v_item->>'data')::date;
    IF v_valor IS NULL OR v_valor <= 0 OR v_valor > 999999999 OR v_data IS NULL THEN
      RAISE EXCEPTION 'Valor ou data da parcela inválidos.' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_parcela FROM public.pagamentos WHERE id = v_id AND acordo_id = p_acordo_id FOR UPDATE;
    IF NOT FOUND OR v_parcela.status <> 'pendente' THEN
      RAISE EXCEPTION 'Só é possível editar parcelas pendentes deste acordo.' USING ERRCODE = '42501';
    END IF;
    UPDATE public.pagamentos SET valor_parcela = round(v_valor, 2), data_prevista = v_data,
      comissao_parcela = round(v_valor * v_acordo.percentual_comissao / 100.0, 2)
    WHERE id = v_id;
  END LOOP;

  SELECT count(*), count(*) FILTER (WHERE status = 'pago'), coalesce(max(numero_parcela), 0)
    INTO v_count, v_pagas, v_max FROM public.pagamentos WHERE acordo_id = p_acordo_id;
  IF p_quantidade < v_pagas THEN
    RAISE EXCEPTION 'O acordo já tem % parcela(s) paga(s); a quantidade não pode ser menor.', v_pagas USING ERRCODE = '22023';
  END IF;

  IF p_quantidade > v_count THEN
    IF jsonb_array_length(p_novas) <> p_quantidade - v_count THEN
      RAISE EXCEPTION 'Informe valor e vencimento das novas parcelas.' USING ERRCODE = '22023';
    END IF;
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_novas) LOOP
      v_valor := (v_item->>'valor')::numeric; v_data := (v_item->>'data')::date;
      IF v_valor IS NULL OR v_valor <= 0 OR v_valor > 999999999 OR v_data IS NULL THEN
        RAISE EXCEPTION 'Valor ou data da nova parcela inválidos.' USING ERRCODE = '22023';
      END IF;
      v_max := v_max + 1;
      INSERT INTO public.pagamentos (acordo_id, numero_parcela, data_prevista, valor_parcela, comissao_parcela, status)
      VALUES (p_acordo_id, v_max, v_data, round(v_valor, 2), round(v_valor * v_acordo.percentual_comissao / 100.0, 2), 'pendente');
    END LOOP;
  ELSIF p_quantidade < v_count THEN
    v_remover := v_count - p_quantidade;
    DELETE FROM public.pagamentos WHERE id IN (
      SELECT id FROM public.pagamentos WHERE acordo_id = p_acordo_id AND status = 'pendente'
      ORDER BY numero_parcela DESC LIMIT v_remover);
  END IF;

  SELECT coalesce(sum(valor_parcela), 0), coalesce(sum(comissao_parcela), 0), count(*), min(data_prevista)
    INTO v_total, v_comissao, v_count, v_data FROM public.pagamentos WHERE acordo_id = p_acordo_id;

  UPDATE public.acordos SET
    cliente_nome = upper(trim(p_nome)), cliente_cpf = v_cpf, cliente_telefone = v_tel,
    parcelas = v_count, valor_total = v_total, comissao_total = v_comissao,
    valor_parcela = CASE WHEN v_count > 0 THEN round(v_total / v_count, 2) ELSE valor_parcela END,
    data_primeiro_pagamento = coalesce(v_data, data_primeiro_pagamento)
  WHERE id = p_acordo_id RETURNING * INTO v_acordo;
  RETURN v_acordo;
END;
$$;
REVOKE ALL ON FUNCTION public.editar_acordo_proprio_completo(uuid,text,text,text,integer,jsonb,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.editar_acordo_proprio_completo(uuid,text,text,text,integer,jsonb,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.proteger_edicao_acordo_proprietario()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF COALESCE(current_setting('app.edicao_pagamento_global', true), '') = 'sim' THEN RETURN NEW; END IF;
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::public.app_role) THEN RETURN NEW; END IF;
  IF OLD.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Somente o responsável pode editar este acordo.' USING ERRCODE = '42501';
  END IF;
  IF (to_jsonb(NEW) - 'atualizado_em' - 'status' - 'boleto_enviado' - 'duplicado_verificado' - 'whatsapp_opt_in' - 'whatsapp_opt_in_em' - 'whatsapp_opt_in_origem' - 'empresa') IS DISTINCT FROM
     (to_jsonb(OLD) - 'atualizado_em' - 'status' - 'boleto_enviado' - 'duplicado_verificado' - 'whatsapp_opt_in' - 'whatsapp_opt_in_em' - 'whatsapp_opt_in_origem' - 'empresa')
     AND COALESCE(current_setting('app.edicao_acordo_proprietario', true), '') <> 'sim' THEN
    RAISE EXCEPTION 'Campos restritos à administração ou à edição autorizada.' USING ERRCODE = '42501';
  END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.dias_atraso IS DISTINCT FROM OLD.dias_atraso
     OR NEW.percentual_comissao IS DISTINCT FROM OLD.percentual_comissao
     OR NEW.observacoes IS DISTINCT FROM OLD.observacoes
     OR NEW.instancia_negociacao_id IS DISTINCT FROM OLD.instancia_negociacao_id
     OR ((NEW.cliente_nome IS DISTINCT FROM OLD.cliente_nome OR NEW.cliente_cpf IS DISTINCT FROM OLD.cliente_cpf
          OR NEW.parcelas IS DISTINCT FROM OLD.parcelas OR NEW.data_primeiro_pagamento IS DISTINCT FROM OLD.data_primeiro_pagamento)
         AND COALESCE(current_setting('app.edicao_acordo_proprietario', true), '') <> 'sim') THEN
    RAISE EXCEPTION 'Campos restritos à administração.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;