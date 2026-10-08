ALTER TABLE public.meta_atrasados_config ADD COLUMN IF NOT EXISTS custo_autorizado_em timestamptz;
CREATE OR REPLACE FUNCTION public.meta_atrasados_require_consent()
RETURNS trigger LANGUAGE plpgsql SET search_path TO public AS $$
BEGIN
 IF NEW.ativo AND (TG_OP='INSERT' OR OLD.ativo IS DISTINCT FROM TRUE) THEN
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM NEW.owner_id OR NOT public.has_role(auth.uid(),'admin') OR NOT public.user_can_access_tenant(auth.uid(),NEW.tenant_id) THEN
   RAISE EXCEPTION 'Somente o administrador proprietário pode confirmar a ativação e o custo';
  END IF;
  NEW.custo_autorizado_em := now();
 END IF;
 IF NEW.ativo AND NEW.custo_autorizado_em IS NULL THEN
  RAISE EXCEPTION 'Ativação aguardando autorização do custo da continuação temporária';
 END IF;
 RETURN NEW;
END;
$$;
COMMENT ON COLUMN public.meta_atrasados_config.custo_autorizado_em IS 'Timestamp of owner-admin confirmation of paid overdue reminders and bounded continuation.';