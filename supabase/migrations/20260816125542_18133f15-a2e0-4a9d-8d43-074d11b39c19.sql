CREATE OR REPLACE FUNCTION public.meta_bm_guard_padrao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Não-admin não define BM padrão: em vez de bloquear o cadastro, apenas ignora a flag
  IF NEW.padrao IS TRUE
     AND (TG_OP = 'INSERT' OR COALESCE(OLD.padrao, false) IS DISTINCT FROM true)
     AND auth.uid() IS NOT NULL
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.padrao := false;
  END IF;
  RETURN NEW;
END;
$$;