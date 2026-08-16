-- 1) Quem cadastrou a BM
ALTER TABLE public.meta_business_managers
  ADD COLUMN IF NOT EXISTS criado_por uuid;

CREATE OR REPLACE FUNCTION public.meta_bm_set_criado_por()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.criado_por IS NULL THEN
    NEW.criado_por := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_meta_bm_set_criado_por ON public.meta_business_managers;
CREATE TRIGGER trg_meta_bm_set_criado_por
BEFORE INSERT ON public.meta_business_managers
FOR EACH ROW EXECUTE FUNCTION public.meta_bm_set_criado_por();

-- 2) Somente admin pode definir a BM padrão
CREATE OR REPLACE FUNCTION public.meta_bm_guard_padrao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.padrao IS TRUE
     AND (TG_OP = 'INSERT' OR COALESCE(OLD.padrao, false) IS DISTINCT FROM true)
     AND auth.uid() IS NOT NULL
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem definir a BM padrão';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_meta_bm_guard_padrao ON public.meta_business_managers;
CREATE TRIGGER trg_meta_bm_guard_padrao
BEFORE INSERT OR UPDATE ON public.meta_business_managers
FOR EACH ROW EXECUTE FUNCTION public.meta_bm_guard_padrao();

-- 3) Políticas para parceiros Meta (isoladas: só as próprias BMs)
DROP POLICY IF EXISTS meta_bm_parceiro_insert ON public.meta_business_managers;
CREATE POLICY meta_bm_parceiro_insert ON public.meta_business_managers
FOR INSERT TO authenticated
WITH CHECK (public.is_parceiro_meta(auth.uid()) AND criado_por = auth.uid());

DROP POLICY IF EXISTS meta_bm_parceiro_select_own ON public.meta_business_managers;
CREATE POLICY meta_bm_parceiro_select_own ON public.meta_business_managers
FOR SELECT TO authenticated
USING (public.is_parceiro_meta(auth.uid()) AND criado_por = auth.uid());

DROP POLICY IF EXISTS meta_bm_parceiro_update_own ON public.meta_business_managers;
CREATE POLICY meta_bm_parceiro_update_own ON public.meta_business_managers
FOR UPDATE TO authenticated
USING (public.is_parceiro_meta(auth.uid()) AND criado_por = auth.uid())
WITH CHECK (public.is_parceiro_meta(auth.uid()) AND criado_por = auth.uid());

DROP POLICY IF EXISTS meta_bm_parceiro_delete_own ON public.meta_business_managers;
CREATE POLICY meta_bm_parceiro_delete_own ON public.meta_business_managers
FOR DELETE TO authenticated
USING (public.is_parceiro_meta(auth.uid()) AND criado_por = auth.uid());

-- 4) Instância criada por parceiro já nasce vinculada a ele
CREATE OR REPLACE FUNCTION public.meta_instancia_vincular_criador_parceiro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND public.is_parceiro_meta(NEW.user_id) THEN
    INSERT INTO public.meta_instance_parceiros (instancia_id, user_id)
    VALUES (NEW.id, NEW.user_id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_meta_instancia_vincular_criador ON public.meta_whatsapp_instances;
CREATE TRIGGER trg_meta_instancia_vincular_criador
AFTER INSERT ON public.meta_whatsapp_instances
FOR EACH ROW EXECUTE FUNCTION public.meta_instancia_vincular_criador_parceiro();