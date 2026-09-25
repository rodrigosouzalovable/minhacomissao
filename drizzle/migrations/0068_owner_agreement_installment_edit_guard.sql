-- Restrict generic edits of owner/financial fields without interrupting normal status and boleto updates.
CREATE OR REPLACE FUNCTION public.proteger_edicao_acordo_proprietario()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::public.app_role) THEN RETURN NEW; END IF;
  IF OLD.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Somente o responsável pode editar este acordo.' USING ERRCODE = '42501';
  END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.cliente_nome IS DISTINCT FROM OLD.cliente_nome
     OR NEW.cliente_cpf IS DISTINCT FROM OLD.cliente_cpf OR NEW.parcelas IS DISTINCT FROM OLD.parcelas
     OR NEW.data_primeiro_pagamento IS DISTINCT FROM OLD.data_primeiro_pagamento
     OR NEW.dias_atraso IS DISTINCT FROM OLD.dias_atraso
     OR NEW.percentual_comissao IS DISTINCT FROM OLD.percentual_comissao
     OR NEW.observacoes IS DISTINCT FROM OLD.observacoes THEN
    RAISE EXCEPTION 'Campos restritos à administração.' USING ERRCODE = '42501';
  END IF;
  IF (NEW.cliente_telefone IS DISTINCT FROM OLD.cliente_telefone
      OR NEW.valor_total IS DISTINCT FROM OLD.valor_total
      OR NEW.valor_parcela IS DISTINCT FROM OLD.valor_parcela
      OR NEW.comissao_total IS DISTINCT FROM OLD.comissao_total)
     AND COALESCE(current_setting('app.edicao_acordo_proprietario', true), '') <> 'sim' THEN
    RAISE EXCEPTION 'Use a edição autorizada para telefone e parcelas.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER proteger_edicao_acordo_proprietario_trigger BEFORE UPDATE ON public.acordos FOR EACH ROW EXECUTE FUNCTION public.proteger_edicao_acordo_proprietario();

CREATE OR REPLACE FUNCTION public.proteger_edicao_parcela_proprietario()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner uuid;
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::public.app_role) THEN RETURN NEW; END IF;
  SELECT user_id INTO v_owner FROM public.acordos WHERE id = OLD.acordo_id;
  IF v_owner IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Somente o responsável pode editar parcelas deste acordo.' USING ERRCODE = '42501';
  END IF;
  IF NEW.acordo_id IS DISTINCT FROM OLD.acordo_id OR NEW.numero_parcela IS DISTINCT FROM OLD.numero_parcela
      OR NEW.status IS DISTINCT FROM OLD.status AND OLD.status = 'pago' AND NEW.status <> 'pendente' THEN
    RAISE EXCEPTION 'Alteração de parcela não permitida.' USING ERRCODE = '42501';
  END IF;
  IF (NEW.valor_parcela IS DISTINCT FROM OLD.valor_parcela OR NEW.comissao_parcela IS DISTINCT FROM OLD.comissao_parcela)
     AND COALESCE(current_setting('app.edicao_acordo_proprietario', true), '') <> 'sim' THEN
    RAISE EXCEPTION 'Use a edição autorizada para o valor da parcela.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER proteger_edicao_parcela_proprietario_trigger BEFORE UPDATE ON public.pagamentos FOR EACH ROW EXECUTE FUNCTION public.proteger_edicao_parcela_proprietario();

CREATE OR REPLACE FUNCTION public.editar_acordo_proprio(p_acordo_id uuid, p_telefone text, p_parcelas jsonb DEFAULT '[]'::jsonb)
RETURNS public.acordos LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_acordo public.acordos%ROWTYPE;
  v_parcela public.pagamentos%ROWTYPE;
  v_item jsonb;
  v_id uuid;
  v_valor numeric;
  v_data date;
  v_total numeric;
  v_comissao numeric;
  v_count integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login para editar.' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_acordo FROM public.acordos WHERE id = p_acordo_id FOR UPDATE;
  IF NOT FOUND OR v_acordo.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Você só pode editar seus próprios acordos.' USING ERRCODE = '42501';
  END IF;
  IF p_telefone IS NOT NULL AND (length(p_telefone) > 15 OR p_telefone !~ '^[0-9 ()+.-]*$') THEN
    RAISE EXCEPTION 'Telefone inválido.' USING ERRCODE = '22023';
  END IF;
  IF p_parcelas IS NULL OR jsonb_typeof(p_parcelas) <> 'array' OR jsonb_array_length(p_parcelas) > 120 THEN
    RAISE EXCEPTION 'Lista de parcelas inválida.' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(p_parcelas) AS t(item)) <>
     (SELECT count(DISTINCT item->>'id') FROM jsonb_array_elements(p_parcelas) AS t(item)) THEN
    RAISE EXCEPTION 'Parcelas repetidas.' USING ERRCODE = '22023';
  END IF;
  PERFORM set_config('app.edicao_acordo_proprietario', 'sim', true);
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_parcelas) LOOP
    IF jsonb_typeof(v_item) <> 'object' OR NOT (v_item ? 'id') OR NOT (v_item ? 'valor') OR NOT (v_item ? 'data') THEN
      RAISE EXCEPTION 'Dados da parcela incompletos.' USING ERRCODE = '22023';
    END IF;
    v_id := (v_item->>'id')::uuid;
    v_valor := (v_item->>'valor')::numeric;
    v_data := (v_item->>'data')::date;
    IF v_valor IS NULL OR v_valor <= 0 OR v_valor > 999999999 OR v_data IS NULL OR v_data::text <> v_item->>'data' THEN
      RAISE EXCEPTION 'Valor ou data da parcela inválidos.' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_parcela FROM public.pagamentos WHERE id = v_id AND acordo_id = p_acordo_id FOR UPDATE;
    IF NOT FOUND OR v_parcela.status <> 'pendente' THEN
      RAISE EXCEPTION 'Só é possível editar parcelas pendentes deste acordo.' USING ERRCODE = '42501';
    END IF;
    UPDATE public.pagamentos SET valor_parcela = round(v_valor, 2), data_prevista = v_data,
      comissao_parcela = round(v_valor * (CASE WHEN v_parcela.valor_parcela > 0 THEN v_parcela.comissao_parcela / v_parcela.valor_parcela ELSE v_acordo.percentual_comissao / 100.0 END), 2)
    WHERE id = v_id;
  END LOOP;
  SELECT COALESCE(sum(valor_parcela), 0), COALESCE(sum(comissao_parcela), 0), count(*)
    INTO v_total, v_comissao, v_count FROM public.pagamentos WHERE acordo_id = p_acordo_id;
  UPDATE public.acordos SET cliente_telefone = nullif(trim(p_telefone), ''),
    valor_total = CASE WHEN jsonb_array_length(p_parcelas) > 0 THEN v_total ELSE valor_total END,
    valor_parcela = CASE WHEN jsonb_array_length(p_parcelas) > 0 AND v_count > 0 THEN round(v_total / v_count, 2) ELSE valor_parcela END,
    comissao_total = CASE WHEN jsonb_array_length(p_parcelas) > 0 THEN v_comissao ELSE comissao_total END
  WHERE id = p_acordo_id RETURNING * INTO v_acordo;
  RETURN v_acordo;
END;
$$;
REVOKE ALL ON FUNCTION public.editar_acordo_proprio(uuid,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.editar_acordo_proprio(uuid,text,jsonb) TO authenticated;