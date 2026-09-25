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