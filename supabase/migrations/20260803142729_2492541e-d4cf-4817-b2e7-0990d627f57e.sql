CREATE OR REPLACE FUNCTION public.meta_etiqueta_atendente_exclusiva()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nome text;
BEGIN
  SELECT nome INTO v_nome FROM public.meta_whatsapp_etiquetas WHERE id = NEW.etiqueta_id;
  IF v_nome IS NULL OR v_nome NOT ILIKE 'Atendente:%' THEN
    RETURN NEW;
  END IF;

  DELETE FROM public.meta_whatsapp_contato_etiquetas ce
  USING public.meta_whatsapp_etiquetas e
  WHERE ce.etiqueta_id = e.id
    AND ce.contato_id = NEW.contato_id
    AND ce.etiqueta_id <> NEW.etiqueta_id
    AND e.nome ILIKE 'Atendente:%';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_meta_etiqueta_atendente_exclusiva ON public.meta_whatsapp_contato_etiquetas;
CREATE TRIGGER trg_meta_etiqueta_atendente_exclusiva
BEFORE INSERT ON public.meta_whatsapp_contato_etiquetas
FOR EACH ROW EXECUTE FUNCTION public.meta_etiqueta_atendente_exclusiva();