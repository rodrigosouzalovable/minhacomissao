CREATE OR REPLACE FUNCTION public.meta_etiqueta_rodrigo_travada(_contato uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.meta_whatsapp_contato_etiquetas ce
    JOIN public.meta_whatsapp_etiquetas e ON e.id = ce.etiqueta_id
    WHERE ce.contato_id = _contato
      AND lower(btrim(e.nome)) = lower('Atendente: RODRIGO RIBEIRO DE SOUZA'))
$$;

CREATE OR REPLACE FUNCTION public.meta_etiqueta_atendente_exclusiva()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_nome text;
  v_existente uuid;
  v_existente_nome text;
BEGIN
  SELECT nome INTO v_nome FROM public.meta_whatsapp_etiquetas WHERE id = NEW.etiqueta_id;
  IF v_nome IS NULL OR v_nome NOT ILIKE 'Atendente:%' THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.contato_id::text, 0));

  SELECT ce.id, e.nome INTO v_existente, v_existente_nome
  FROM public.meta_whatsapp_contato_etiquetas ce
  JOIN public.meta_whatsapp_etiquetas e ON e.id = ce.etiqueta_id
  WHERE ce.contato_id = NEW.contato_id
    AND e.nome ILIKE 'Atendente:%'
  FOR UPDATE
  LIMIT 1;

  IF v_existente IS NULL THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.origem, '') = 'auto_atendente' THEN
    RETURN NULL;
  END IF;

  -- Etiqueta do Rodrigo travada: só ele, admins ou o servidor podem trocar
  IF lower(btrim(v_existente_nome)) = lower('Atendente: RODRIGO RIBEIRO DE SOUZA') THEN
    IF lower(btrim(v_nome)) = lower(btrim(v_existente_nome)) THEN
      RETURN NULL;
    END IF;
    IF auth.uid() IS NOT NULL
       AND auth.uid() <> 'ee649720-b8ce-47a2-859e-100a3a9ae6bb'::uuid
       AND NOT public.has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'ETIQUETA_RODRIGO_TRAVADA: Esta conversa pertence a Rodrigo Ribeiro de Souza e não pode ser reatribuída.';
    END IF;
  END IF;

  DELETE FROM public.meta_whatsapp_contato_etiquetas ce
  USING public.meta_whatsapp_etiquetas e
  WHERE ce.etiqueta_id = e.id
    AND ce.contato_id = NEW.contato_id
    AND e.nome ILIKE 'Atendente:%';

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.meta_etiqueta_rodrigo_bloqueia_remocao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_nome text;
BEGIN
  SELECT nome INTO v_nome FROM public.meta_whatsapp_etiquetas WHERE id = OLD.etiqueta_id;
  IF lower(btrim(coalesce(v_nome,''))) = lower('Atendente: RODRIGO RIBEIRO DE SOUZA')
     AND auth.uid() IS NOT NULL
     AND auth.uid() <> 'ee649720-b8ce-47a2-859e-100a3a9ae6bb'::uuid
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'ETIQUETA_RODRIGO_TRAVADA: Esta conversa pertence a Rodrigo Ribeiro de Souza e não pode ser reatribuída.';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_meta_etiqueta_rodrigo_bloqueia_remocao ON public.meta_whatsapp_contato_etiquetas;
CREATE TRIGGER trg_meta_etiqueta_rodrigo_bloqueia_remocao
BEFORE DELETE ON public.meta_whatsapp_contato_etiquetas
FOR EACH ROW EXECUTE FUNCTION public.meta_etiqueta_rodrigo_bloqueia_remocao();