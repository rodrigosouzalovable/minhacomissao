-- ai_usage_log
DROP POLICY IF EXISTS "Service inserts ai_usage_log" ON public.ai_usage_log;
CREATE POLICY "Authenticated can insert ai_usage_log"
  ON public.ai_usage_log
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- acordos / pagamentos / user_whatsapp_instances blanket reads
DROP POLICY IF EXISTS "Authenticated users can view all acordos" ON public.acordos;
DROP POLICY IF EXISTS "Authenticated users can view all pagamentos" ON public.pagamentos;
DROP POLICY IF EXISTS "Authenticated users can view all instances" ON public.user_whatsapp_instances;

-- Helpers
CREATE OR REPLACE FUNCTION public.can_view_credor(_user uuid, _credor text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _user IS NOT NULL AND (
    public.has_role(_user, 'admin'::public.app_role)
    OR public.has_role(_user, 'gestor'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_id = _user
        AND (
          COALESCE(array_length(up.credores, 1), 0) = 0
          OR _credor = ANY(up.credores)
        )
    )
    OR NOT EXISTS (
      SELECT 1 FROM public.user_permissions up2 WHERE up2.user_id = _user
    )
  )
$$;
REVOKE EXECUTE ON FUNCTION public.can_view_credor(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_credor(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_view_devedor_cpf(_user uuid, _cpf text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _user IS NOT NULL AND (
    public.has_role(_user, 'admin'::public.app_role)
    OR public.has_role(_user, 'gestor'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.devedores d
      WHERE public.cpf_normalize(d.cpf) = public.cpf_normalize(_cpf)
        AND public.can_view_credor(_user, d.credor)
    )
    OR NOT EXISTS (
      SELECT 1 FROM public.user_permissions up WHERE up.user_id = _user
    )
  )
$$;
REVOKE EXECUTE ON FUNCTION public.can_view_devedor_cpf(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_devedor_cpf(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_view_devedor_id(_user uuid, _devedor_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _user IS NOT NULL AND (
    public.has_role(_user, 'admin'::public.app_role)
    OR public.has_role(_user, 'gestor'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.devedores d
      WHERE d.id = _devedor_id
        AND public.can_view_credor(_user, d.credor)
    )
    OR NOT EXISTS (
      SELECT 1 FROM public.user_permissions up WHERE up.user_id = _user
    )
  )
$$;
REVOKE EXECUTE ON FUNCTION public.can_view_devedor_id(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_devedor_id(uuid, uuid) TO authenticated, service_role;

-- devedores
DROP POLICY IF EXISTS "Usuarios autenticados podem ver devedores" ON public.devedores;
CREATE POLICY "Usuarios autorizados podem ver devedores"
  ON public.devedores FOR SELECT TO authenticated
  USING (public.can_view_credor(auth.uid(), credor));

-- devedor_telefones (devedor_cpf)
DROP POLICY IF EXISTS "Usuarios autenticados podem ver telefones" ON public.devedor_telefones;
CREATE POLICY "Usuarios autorizados podem ver telefones"
  ON public.devedor_telefones FOR SELECT TO authenticated
  USING (public.can_view_devedor_cpf(auth.uid(), devedor_cpf));

-- devedor_eventos (devedor_id)
DROP POLICY IF EXISTS "Usuarios autenticados podem ver eventos" ON public.devedor_eventos;
CREATE POLICY "Usuarios autorizados podem ver eventos"
  ON public.devedor_eventos FOR SELECT TO authenticated
  USING (public.can_view_devedor_id(auth.uid(), devedor_id));

-- acordos_devedor (devedor_cpf)
DROP POLICY IF EXISTS "Usuarios autenticados podem ver acordos_devedor" ON public.acordos_devedor;
CREATE POLICY "Usuarios autorizados podem ver acordos_devedor"
  ON public.acordos_devedor FOR SELECT TO authenticated
  USING (public.can_view_devedor_cpf(auth.uid(), devedor_cpf));

-- parcelas_devedor (acordo_id -> acordos_devedor.devedor_cpf)
DROP POLICY IF EXISTS "Usuarios autenticados podem ver parcelas" ON public.parcelas_devedor;
DROP POLICY IF EXISTS "Usuarios autenticados podem ver parcelas_devedor" ON public.parcelas_devedor;
CREATE POLICY "Usuarios autorizados podem ver parcelas_devedor"
  ON public.parcelas_devedor FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.acordos_devedor ad
      WHERE ad.id = parcelas_devedor.acordo_id
        AND public.can_view_devedor_cpf(auth.uid(), ad.devedor_cpf)
    )
  );

-- storage: devedor-arquivos read
DROP POLICY IF EXISTS "Usuarios autenticados podem ver arquivos" ON storage.objects;
CREATE POLICY "Owner or admin can read devedor-arquivos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'devedor-arquivos'
    AND (
      owner = auth.uid()
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'gestor'::public.app_role)
    )
  );