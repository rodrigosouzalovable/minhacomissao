-- 1) flag de parceiro
ALTER TABLE public.user_permissions
  ADD COLUMN IF NOT EXISTS parceiro_meta boolean NOT NULL DEFAULT false;

-- 2) tabela de vinculo instancia <-> parceiro
CREATE TABLE IF NOT EXISTS public.meta_instance_parceiros (
  instancia_id uuid NOT NULL REFERENCES public.meta_whatsapp_instances(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (instancia_id, user_id)
);

GRANT SELECT ON public.meta_instance_parceiros TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.meta_instance_parceiros TO authenticated;
GRANT ALL ON public.meta_instance_parceiros TO service_role;

ALTER TABLE public.meta_instance_parceiros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parceiros_admin_all" ON public.meta_instance_parceiros
  FOR ALL TO authenticated
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

CREATE POLICY "parceiros_self_select" ON public.meta_instance_parceiros
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_meta_instance_parceiros_user ON public.meta_instance_parceiros(user_id);

-- 3) helpers
CREATE OR REPLACE FUNCTION public.is_parceiro_meta(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE((SELECT parceiro_meta FROM public.user_permissions WHERE user_id = _uid), false)
$$;

CREATE OR REPLACE FUNCTION public.parceiro_tem_instancia(_uid uuid, _instancia uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.meta_instance_parceiros
    WHERE user_id = _uid AND instancia_id = _instancia
  )
$$;

CREATE OR REPLACE FUNCTION public.pode_ver_instancia_meta(_uid uuid, _instancia uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE
    WHEN _uid IS NULL THEN false
    WHEN public.is_admin_user(_uid) THEN true
    WHEN public.is_parceiro_meta(_uid) THEN public.parceiro_tem_instancia(_uid, _instancia)
    ELSE EXISTS (
      SELECT 1 FROM public.meta_whatsapp_instances i
      WHERE i.id = _instancia
        AND (
          i.user_id = _uid
          OR public.has_any_meta_folder_access(_uid)
          OR public.has_inbox_compartilhado(_uid)
          OR public.user_can_access_tenant(_uid, i.tenant_id)
        )
    )
  END
$$;

-- 4) politicas de instancias: parceiro so ve as vinculadas
DROP POLICY IF EXISTS "meta_instances_folder_member_select" ON public.meta_whatsapp_instances;
CREATE POLICY "meta_instances_folder_member_select" ON public.meta_whatsapp_instances
  FOR SELECT TO authenticated
  USING (public.has_any_meta_folder_access(auth.uid()) AND NOT public.is_parceiro_meta(auth.uid()));

DROP POLICY IF EXISTS "meta_instances_shared_select" ON public.meta_whatsapp_instances;
CREATE POLICY "meta_instances_shared_select" ON public.meta_whatsapp_instances
  FOR SELECT TO authenticated
  USING (public.has_inbox_compartilhado(auth.uid()) AND NOT public.is_parceiro_meta(auth.uid()));

DROP POLICY IF EXISTS "tenant_scope_all" ON public.meta_whatsapp_instances;
CREATE POLICY "tenant_scope_all" ON public.meta_whatsapp_instances
  FOR ALL TO authenticated
  USING (public.user_can_access_tenant(auth.uid(), tenant_id) AND NOT public.is_parceiro_meta(auth.uid()))
  WITH CHECK (public.user_can_access_tenant(auth.uid(), tenant_id) AND NOT public.is_parceiro_meta(auth.uid()));

DROP POLICY IF EXISTS "Users manage own meta instances" ON public.meta_whatsapp_instances;
CREATE POLICY "Users manage own meta instances" ON public.meta_whatsapp_instances
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (auth.uid() = user_id AND (NOT public.is_parceiro_meta(auth.uid()) OR public.parceiro_tem_instancia(auth.uid(), id)))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR auth.uid() = user_id
  );

CREATE POLICY "meta_instances_parceiro_select" ON public.meta_whatsapp_instances
  FOR SELECT TO authenticated
  USING (public.is_parceiro_meta(auth.uid()) AND public.parceiro_tem_instancia(auth.uid(), id));

CREATE POLICY "meta_instances_parceiro_update" ON public.meta_whatsapp_instances
  FOR UPDATE TO authenticated
  USING (public.is_parceiro_meta(auth.uid()) AND public.parceiro_tem_instancia(auth.uid(), id))
  WITH CHECK (public.is_parceiro_meta(auth.uid()) AND public.parceiro_tem_instancia(auth.uid(), id));

CREATE POLICY "meta_instances_parceiro_delete" ON public.meta_whatsapp_instances
  FOR DELETE TO authenticated
  USING (public.is_parceiro_meta(auth.uid()) AND public.parceiro_tem_instancia(auth.uid(), id));

-- 5) instancia criada por parceiro vira dele automaticamente
CREATE OR REPLACE FUNCTION public.meta_instance_auto_vincular_parceiro()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND public.is_parceiro_meta(NEW.user_id) THEN
    INSERT INTO public.meta_instance_parceiros (instancia_id, user_id)
    VALUES (NEW.id, NEW.user_id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_meta_instance_auto_vincular ON public.meta_whatsapp_instances;
CREATE TRIGGER trg_meta_instance_auto_vincular
  AFTER INSERT ON public.meta_whatsapp_instances
  FOR EACH ROW EXECUTE FUNCTION public.meta_instance_auto_vincular_parceiro();

-- 6) envio: RPC de instancias ativas respeita o escopo
CREATE OR REPLACE FUNCTION public.get_meta_whatsapp_active_instances_for_sending()
 RETURNS TABLE(id uuid, nome text, display_phone text, ativo boolean, saude_status text, saude_quality text, saude_name_status text, saude_ban_info jsonb, saude_checked_at timestamp with time zone)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT i.id, i.nome, i.display_phone, i.ativo, i.saude_status, i.saude_quality,
         i.saude_name_status, i.saude_ban_info, i.saude_checked_at
  FROM public.meta_whatsapp_instances i
  WHERE i.ativo = true
    AND public.pode_ver_instancia_meta(auth.uid(), i.id)
  ORDER BY i.nome;
$$;

-- 7) templates: parceiro gerencia apenas os das instancias dele
CREATE POLICY "meta_templates_instancia_parceiro_all" ON public.meta_templates_instancia
  FOR ALL TO authenticated
  USING (public.is_parceiro_meta(auth.uid()) AND public.parceiro_tem_instancia(auth.uid(), instancia_id))
  WITH CHECK (public.is_parceiro_meta(auth.uid()) AND public.parceiro_tem_instancia(auth.uid(), instancia_id));

CREATE POLICY "meta_templates_mestre_parceiro_all" ON public.meta_templates_mestre
  FOR ALL TO authenticated
  USING (public.is_parceiro_meta(auth.uid()) AND criado_por = auth.uid())
  WITH CHECK (public.is_parceiro_meta(auth.uid()) AND criado_por = auth.uid());

-- 8) BMs usadas pelas instancias do parceiro
CREATE POLICY "meta_bm_parceiro_select" ON public.meta_business_managers
  FOR SELECT TO authenticated
  USING (
    public.is_parceiro_meta(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.meta_whatsapp_instances i
      JOIN public.meta_instance_parceiros p ON p.instancia_id = i.id AND p.user_id = auth.uid()
      WHERE i.meta_bm_id = meta_business_managers.id
    )
  );