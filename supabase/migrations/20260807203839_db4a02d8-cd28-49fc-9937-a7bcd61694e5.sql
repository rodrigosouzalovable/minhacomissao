-- 1. Fila de atendimento: remove leitura para qualquer autenticado (tenant_scope_all já cobre membros do tenant)
DROP POLICY IF EXISTS "fila_read_authenticated" ON public.meta_atendimento_fila;
CREATE POLICY "fila_read_tenant_members" ON public.meta_atendimento_fila
FOR SELECT TO authenticated
USING (public.user_can_access_tenant(auth.uid(), tenant_id) OR public.is_admin_user(auth.uid()));

-- 2. Caixa Padrão: exige atendente ativo do Inbox Meta (ou admin)
CREATE OR REPLACE FUNCTION public.can_access_meta_inbox_default(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT _uid IS NOT NULL AND (
    public.has_role(_uid, 'admin'::app_role)
    OR (
      EXISTS (SELECT 1 FROM public.meta_inbox_default_members m WHERE m.user_id = _uid)
      AND COALESCE(
        (SELECT up.atende_inbox_meta FROM public.user_permissions up WHERE up.user_id = _uid),
        true
      )
    )
  )
$function$;

-- 3. Config 3C Plus (token de integração): somente admin
DROP POLICY IF EXISTS "tresc_config_select" ON public.tresc_config;
CREATE POLICY "tresc_config_select_admin" ON public.tresc_config
FOR SELECT TO authenticated
USING (public.is_admin_user(auth.uid()));

-- 4. Ligações/qualificações 3C e destinos de relatório: admin ou gestor
DROP POLICY IF EXISTS "tresc_lig_select" ON public.tresc_ligacoes;
CREATE POLICY "tresc_lig_select_admin_gestor" ON public.tresc_ligacoes
FOR SELECT TO authenticated
USING (public.is_admin_user(auth.uid()) OR public.has_role(auth.uid(), 'gestor'::app_role));

DROP POLICY IF EXISTS "tresc_qual_select" ON public.tresc_qualificacoes;
CREATE POLICY "tresc_qual_select_admin_gestor" ON public.tresc_qualificacoes
FOR SELECT TO authenticated
USING (public.is_admin_user(auth.uid()) OR public.has_role(auth.uid(), 'gestor'::app_role));

DROP POLICY IF EXISTS "relatorio_destinos_select_auth" ON public.relatorio_destinos;
CREATE POLICY "relatorio_destinos_select_admin_gestor" ON public.relatorio_destinos
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));

-- 5. Comitê Novo Mundo: admin ou gestor
DROP POLICY IF EXISTS "comite_metas_select_auth" ON public.comite_metas_novomundo;
CREATE POLICY "comite_metas_select_admin_gestor" ON public.comite_metas_novomundo
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));

DROP POLICY IF EXISTS "comite_textos_select_auth" ON public.comite_textos_novomundo;
CREATE POLICY "comite_textos_select_admin_gestor" ON public.comite_textos_novomundo
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));

-- 6. Storage: leitura restrita nos buckets privados meta-perfis e meta-template-media
DROP POLICY IF EXISTS "Authenticated can read meta profile pics" ON storage.objects;
CREATE POLICY "Admins read meta-perfis" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'meta-perfis'
  AND (public.is_admin_user(auth.uid()) OR public.has_role(auth.uid(), 'gestor'::app_role))
);

DROP POLICY IF EXISTS "Read meta-template-media" ON storage.objects;
CREATE POLICY "Admins read meta-template-media" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'meta-template-media'
  AND (public.is_admin_user(auth.uid()) OR public.has_role(auth.uid(), 'gestor'::app_role))
);