SET lock_timeout = '10s';
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS meta_folder_padrao_id uuid;

CREATE OR REPLACE FUNCTION public.meta_contato_caixa_parceiro()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_folder uuid;
BEGIN
  IF NEW.folder_id IS NOT NULL OR NEW.instancia_id IS NULL THEN RETURN NEW; END IF;
  SELECT up.meta_folder_padrao_id INTO v_folder
  FROM public.meta_whatsapp_instances i
  JOIN public.user_permissions up ON up.user_id = i.user_id
  WHERE i.id = NEW.instancia_id AND up.parceiro_meta = true;
  IF v_folder IS NOT NULL THEN NEW.folder_id := v_folder; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_meta_contato_caixa_parceiro ON public.meta_whatsapp_contatos;
CREATE TRIGGER trg_meta_contato_caixa_parceiro
BEFORE INSERT OR UPDATE OF folder_id ON public.meta_whatsapp_contatos
FOR EACH ROW EXECUTE FUNCTION public.meta_contato_caixa_parceiro();