CREATE OR REPLACE FUNCTION public.meta_contato_dispensa_zera_nao_lido()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.sla_dispensado_em IS NOT NULL
     AND NEW.sla_dispensado_em >= coalesce(NEW.ultima_msg_entrada_em, '-infinity'::timestamptz)
     AND coalesce(NEW.nao_lido, 0) <> 0 THEN
    NEW.nao_lido := 0;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_meta_contato_dispensa_zera_nao_lido ON public.meta_whatsapp_contatos;
CREATE TRIGGER trg_meta_contato_dispensa_zera_nao_lido
BEFORE INSERT OR UPDATE ON public.meta_whatsapp_contatos
FOR EACH ROW EXECUTE FUNCTION public.meta_contato_dispensa_zera_nao_lido();