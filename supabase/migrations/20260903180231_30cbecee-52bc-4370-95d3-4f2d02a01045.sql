ALTER TABLE public.meta_whatsapp_instances
  ADD COLUMN IF NOT EXISTS aquecimento_meta_ativo boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_meta_instances_aquecimento_meta_ativo
  ON public.meta_whatsapp_instances (aquecimento_meta_ativo)
  WHERE aquecimento_meta_ativo = true;

CREATE OR REPLACE FUNCTION public.meta_aquecimento_flag_admin_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.aquecimento_meta_ativo IS DISTINCT FROM OLD.aquecimento_meta_ativo THEN
    IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'Apenas administradores podem alterar o aquecimento de tier deste numero';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_meta_aquecimento_flag_admin_only ON public.meta_whatsapp_instances;
CREATE TRIGGER trg_meta_aquecimento_flag_admin_only
  BEFORE UPDATE ON public.meta_whatsapp_instances
  FOR EACH ROW EXECUTE FUNCTION public.meta_aquecimento_flag_admin_only();

CREATE OR REPLACE FUNCTION public.meta_aquecimento_flag_admin_only_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.aquecimento_meta_ativo = true THEN
    IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
      NEW.aquecimento_meta_ativo := false;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_meta_aquecimento_flag_admin_only_insert ON public.meta_whatsapp_instances;
CREATE TRIGGER trg_meta_aquecimento_flag_admin_only_insert
  BEFORE INSERT ON public.meta_whatsapp_instances
  FOR EACH ROW EXECUTE FUNCTION public.meta_aquecimento_flag_admin_only_insert();