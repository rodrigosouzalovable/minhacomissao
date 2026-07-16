
-- acordos_devedor: scope UPDATE/DELETE with can_view_devedor_cpf
DROP POLICY IF EXISTS "Usuarios autenticados podem atualizar acordos_devedor" ON public.acordos_devedor;
DROP POLICY IF EXISTS "Usuarios autenticados podem deletar acordos_devedor" ON public.acordos_devedor;
CREATE POLICY "Usuarios autorizados podem atualizar acordos_devedor"
  ON public.acordos_devedor FOR UPDATE TO authenticated
  USING (public.can_view_devedor_cpf(auth.uid(), devedor_cpf))
  WITH CHECK (public.can_view_devedor_cpf(auth.uid(), devedor_cpf));
CREATE POLICY "Usuarios autorizados podem deletar acordos_devedor"
  ON public.acordos_devedor FOR DELETE TO authenticated
  USING (public.can_view_devedor_cpf(auth.uid(), devedor_cpf));

-- devedor_telefones: scope UPDATE with can_view_devedor_cpf
DROP POLICY IF EXISTS "Usuarios autenticados podem atualizar telefones" ON public.devedor_telefones;
CREATE POLICY "Usuarios autorizados podem atualizar telefones"
  ON public.devedor_telefones FOR UPDATE TO authenticated
  USING (public.can_view_devedor_cpf(auth.uid(), devedor_cpf))
  WITH CHECK (public.can_view_devedor_cpf(auth.uid(), devedor_cpf));

-- devedores: scope UPDATE with can_view_credor
DROP POLICY IF EXISTS "Usuarios autenticados podem atualizar estagio devedores" ON public.devedores;
CREATE POLICY "Usuarios autorizados podem atualizar devedores"
  ON public.devedores FOR UPDATE TO authenticated
  USING (public.can_view_credor(auth.uid(), credor))
  WITH CHECK (public.can_view_credor(auth.uid(), credor));

-- grupo_empresarial_membros: restrict SELECT to admin/gestor
DROP POLICY IF EXISTS "Usuarios autenticados podem ver grupos" ON public.grupo_empresarial_membros;
CREATE POLICY "Admins e gestores podem ver grupos empresariais"
  ON public.grupo_empresarial_membros FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));

-- importacoes: restrict SELECT to admin/gestor
DROP POLICY IF EXISTS "Usuarios autenticados podem ver importacoes" ON public.importacoes;
CREATE POLICY "Admins e gestores podem ver importacoes"
  ON public.importacoes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));

-- whatsapp_contato_etiquetas: scope by instance ownership
DROP POLICY IF EXISTS "Authenticated can view contato_etiquetas" ON public.whatsapp_contato_etiquetas;
DROP POLICY IF EXISTS "Authenticated can insert contato_etiquetas" ON public.whatsapp_contato_etiquetas;
DROP POLICY IF EXISTS "Authenticated can delete contato_etiquetas" ON public.whatsapp_contato_etiquetas;
CREATE POLICY "Owners can view contato_etiquetas"
  ON public.whatsapp_contato_etiquetas FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.whatsapp_contatos c
      WHERE c.id = whatsapp_contato_etiquetas.contato_id
        AND public.owns_whatsapp_instance(c.instancia_id)
    )
  );
CREATE POLICY "Owners can insert contato_etiquetas"
  ON public.whatsapp_contato_etiquetas FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.whatsapp_contatos c
      WHERE c.id = whatsapp_contato_etiquetas.contato_id
        AND public.owns_whatsapp_instance(c.instancia_id)
    )
  );
CREATE POLICY "Owners can delete contato_etiquetas"
  ON public.whatsapp_contato_etiquetas FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.whatsapp_contatos c
      WHERE c.id = whatsapp_contato_etiquetas.contato_id
        AND public.owns_whatsapp_instance(c.instancia_id)
    )
  );

-- chatbot_conversas: restrict to admin + service_role only
DROP POLICY IF EXISTS "Authenticated users can upsert chatbot_conversas" ON public.chatbot_conversas;
CREATE POLICY "Admins podem gerenciar chatbot_conversas"
  ON public.chatbot_conversas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
