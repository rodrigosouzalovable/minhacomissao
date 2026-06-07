
CREATE OR REPLACE FUNCTION public.handle_boleto_enviado_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_texto text;
  v_suf text;
  v_pagamento uuid;
  v_acordo_id uuid;
BEGIN
  IF NEW.direcao <> 'entrada' THEN RETURN NEW; END IF;

  v_texto := lower(trim(COALESCE(NEW.conteudo, '')));
  IF v_texto IS NULL OR v_texto = '' THEN RETURN NEW; END IF;
  IF position('boleto enviado' in v_texto) = 0 THEN RETURN NEW; END IF;

  v_suf := right(regexp_replace(COALESCE(NEW.telefone_remoto, ''), '[^0-9]', '', 'g'), 8);
  IF length(v_suf) < 8 THEN RETURN NEW; END IF;

  SELECT l.pagamento_id INTO v_pagamento
  FROM public.notificacoes_envios_log l
  JOIN public.notificacoes_operador_telefone t ON t.user_id = l.user_id
  WHERE l.sucesso = true
    AND l.criado_em >= now() - interval '48 hours'
    AND right(regexp_replace(t.telefone, '[^0-9]', '', 'g'), 8) = v_suf
  ORDER BY l.criado_em DESC
  LIMIT 1;

  IF v_pagamento IS NULL THEN RETURN NEW; END IF;

  SELECT acordo_id INTO v_acordo_id FROM public.pagamentos WHERE id = v_pagamento;
  IF v_acordo_id IS NULL THEN RETURN NEW; END IF;

  UPDATE public.acordos
  SET boleto_enviado = true, atualizado_em = now()
  WHERE id = v_acordo_id AND boleto_enviado = false;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_boleto_enviado_reply ON public.whatsapp_mensagens;
CREATE TRIGGER trg_boleto_enviado_reply
AFTER INSERT ON public.whatsapp_mensagens
FOR EACH ROW
EXECUTE FUNCTION public.handle_boleto_enviado_reply();
