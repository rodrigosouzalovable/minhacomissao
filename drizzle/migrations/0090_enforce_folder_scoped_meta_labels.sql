CREATE OR REPLACE FUNCTION public.enforce_meta_etiqueta_folder_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_folder uuid;
BEGIN
  SELECT c.folder_id INTO v_folder
  FROM public.meta_whatsapp_contatos c
  WHERE c.id = NEW.contato_id;

  IF EXISTS (
    SELECT 1
    FROM public.meta_inbox_folder_etiquetas fe
    WHERE fe.etiqueta_id = NEW.etiqueta_id
      AND fe.exclusiva = true
      AND fe.folder_id IS DISTINCT FROM v_folder
  ) THEN
    RAISE EXCEPTION 'Etiqueta exclusiva de outra caixa';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_meta_etiqueta_folder_scope ON public.meta_whatsapp_contato_etiquetas;
CREATE TRIGGER trg_enforce_meta_etiqueta_folder_scope
BEFORE INSERT OR UPDATE OF contato_id, etiqueta_id
ON public.meta_whatsapp_contato_etiquetas
FOR EACH ROW
EXECUTE FUNCTION public.enforce_meta_etiqueta_folder_scope();