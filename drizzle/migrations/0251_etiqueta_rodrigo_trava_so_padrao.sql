CREATE OR REPLACE FUNCTION public.proteger_etiqueta_rodrigo()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rodrigo_etq uuid := '03a9298c-f201-4b4a-ab05-f6e6cafa4116';
  v_admin uuid := 'ee649720-b8ce-47a2-859e-100a3a9ae6bb';
  v_nome text;
  v_folder uuid;
BEGIN
  IF auth.uid() = v_admin THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  -- Trava da etiqueta do Rodrigo vale só na caixa PADRÃO (folder_id nulo)
  SELECT folder_id INTO v_folder FROM meta_whatsapp_contatos
   WHERE id = COALESCE(NEW.contato_id, OLD.contato_id);
  IF v_folder IS NOT NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP = 'DELETE' THEN
    IF OLD.etiqueta_id = v_rodrigo_etq THEN
      RETURN NULL;
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.etiqueta_id <> v_rodrigo_etq AND EXISTS (
    SELECT 1 FROM meta_whatsapp_contato_etiquetas
    WHERE contato_id = NEW.contato_id AND etiqueta_id = v_rodrigo_etq
  ) THEN
    SELECT nome INTO v_nome FROM meta_whatsapp_etiquetas WHERE id = NEW.etiqueta_id;
    IF lower(coalesce(v_nome,'')) LIKE 'atendente:%' THEN
      RETURN NULL;
    END IF;
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.meta_etiqueta_rodrigo_bloqueia_remocao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_nome text; v_folder uuid;
BEGIN
  SELECT folder_id INTO v_folder FROM public.meta_whatsapp_contatos WHERE id = OLD.contato_id;
  IF v_folder IS NOT NULL THEN
    RETURN OLD;
  END IF;
  SELECT nome INTO v_nome FROM public.meta_whatsapp_etiquetas WHERE id = OLD.etiqueta_id;
  IF lower(btrim(coalesce(v_nome,''))) = lower('Atendente: RODRIGO RIBEIRO DE SOUZA')
     AND auth.uid() IS NOT NULL
     AND auth.uid() <> 'ee649720-b8ce-47a2-859e-100a3a9ae6bb'::uuid
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'ETIQUETA_RODRIGO_TRAVADA: Esta conversa pertence a Rodrigo Ribeiro de Souza e não pode ser reatribuída.';
  END IF;
  RETURN OLD;
END;
$function$;

CREATE OR REPLACE FUNCTION public.meta_etiqueta_atendente_exclusiva()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_nome text;
  v_existente uuid;
  v_existente_nome text;
  v_folder uuid;
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

  SELECT folder_id INTO v_folder FROM public.meta_whatsapp_contatos WHERE id = NEW.contato_id;

  -- Etiqueta do Rodrigo travada (só na caixa PADRÃO): só ele, admins ou o servidor podem trocar
  IF v_folder IS NULL AND lower(btrim(v_existente_nome)) = lower('Atendente: RODRIGO RIBEIRO DE SOUZA') THEN
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