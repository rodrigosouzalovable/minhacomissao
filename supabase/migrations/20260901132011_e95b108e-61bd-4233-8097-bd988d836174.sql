CREATE OR REPLACE FUNCTION public.set_user_permissions_atualizado_em()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_user_permissions_updated_at ON public.user_permissions;

CREATE TRIGGER set_user_permissions_atualizado_em
BEFORE UPDATE ON public.user_permissions
FOR EACH ROW EXECUTE FUNCTION public.set_user_permissions_atualizado_em();