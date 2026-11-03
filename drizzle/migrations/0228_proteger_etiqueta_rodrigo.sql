CREATE OR REPLACE FUNCTION public.proteger_etiqueta_rodrigo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rodrigo_etq uuid := '03a9298c-f201-4b4a-ab05-f6e6cafa4116';
  v_admin uuid := 'ee649720-b8ce-47a2-859e-100a3a9ae6bb';
  v_nome text;
BEGIN
  IF auth.uid() = v_admin THEN
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
END $$;

DROP TRIGGER IF EXISTS trg_proteger_etiqueta_rodrigo ON public.meta_whatsapp_contato_etiquetas;
CREATE TRIGGER trg_proteger_etiqueta_rodrigo
BEFORE INSERT OR DELETE ON public.meta_whatsapp_contato_etiquetas
FOR EACH ROW EXECUTE FUNCTION public.proteger_etiqueta_rodrigo();