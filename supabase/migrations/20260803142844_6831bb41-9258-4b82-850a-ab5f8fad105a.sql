CREATE OR REPLACE FUNCTION public.meta_etiqueta_atendente_exclusiva()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nome text;
  v_existente uuid;
BEGIN
  SELECT nome INTO v_nome FROM public.meta_whatsapp_etiquetas WHERE id = NEW.etiqueta_id;
  IF v_nome IS NULL OR v_nome NOT ILIKE 'Atendente:%' THEN
    RETURN NEW;
  END IF;

  SELECT ce.id INTO v_existente
  FROM public.meta_whatsapp_contato_etiquetas ce
  JOIN public.meta_whatsapp_etiquetas e ON e.id = ce.etiqueta_id
  WHERE ce.contato_id = NEW.contato_id
    AND e.nome ILIKE 'Atendente:%'
  FOR UPDATE
  LIMIT 1;

  IF v_existente IS NULL THEN
    RETURN NEW;
  END IF;

  -- Atribuição automática nunca sobrescreve um atendente já definido
  IF COALESCE(NEW.origem, '') = 'auto_atendente' THEN
    RETURN NULL;
  END IF;

  DELETE FROM public.meta_whatsapp_contato_etiquetas ce
  USING public.meta_whatsapp_etiquetas e
  WHERE ce.etiqueta_id = e.id
    AND ce.contato_id = NEW.contato_id
    AND e.nome ILIKE 'Atendente:%';

  RETURN NEW;
END;
$$;