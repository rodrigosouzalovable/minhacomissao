CREATE OR REPLACE FUNCTION public.proteger_edicao_acordo_proprietario()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
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
     OR (NEW.status IS DISTINCT FROM OLD.status AND OLD.status = 'pago' AND NEW.status <> 'pendente') THEN
    RAISE EXCEPTION 'Alteração de parcela não permitida.' USING ERRCODE = '42501';
  END IF;
  IF (to_jsonb(NEW) - 'status' - 'data_paga' - 'data_prevista') IS DISTINCT FROM
     (to_jsonb(OLD) - 'status' - 'data_paga' - 'data_prevista')
     AND COALESCE(current_setting('app.edicao_acordo_proprietario', true), '') <> 'sim' THEN
    RAISE EXCEPTION 'Use a edição autorizada para o valor da parcela.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;