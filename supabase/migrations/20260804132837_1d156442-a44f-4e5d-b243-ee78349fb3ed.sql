-- Helper: usuário é responsável por alguma caixa (ou a caixa padrão)
CREATE OR REPLACE FUNCTION public.has_any_meta_folder_access(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _uid IS NOT NULL AND (
    public.has_role(_uid, 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.meta_inbox_folder_members m WHERE m.user_id = _uid)
    OR EXISTS (SELECT 1 FROM public.meta_inbox_default_members d WHERE d.user_id = _uid)
    OR EXISTS (SELECT 1 FROM public.meta_inbox_folders f WHERE f.owner_id = _uid)
  )
$$;

-- Instâncias: leitura para responsáveis de caixa
DROP POLICY IF EXISTS meta_instances_folder_member_select ON public.meta_whatsapp_instances;
CREATE POLICY meta_instances_folder_member_select
ON public.meta_whatsapp_instances FOR SELECT TO authenticated
USING (public.has_any_meta_folder_access(auth.uid()));

-- Contatos: leitura e atualização das conversas das caixas do usuário
DROP POLICY IF EXISTS meta_contatos_folder_member_select ON public.meta_whatsapp_contatos;
CREATE POLICY meta_contatos_folder_member_select
ON public.meta_whatsapp_contatos FOR SELECT TO authenticated
USING (public.can_view_meta_contato_folder(auth.uid(), folder_id));

DROP POLICY IF EXISTS meta_contatos_folder_member_update ON public.meta_whatsapp_contatos;
CREATE POLICY meta_contatos_folder_member_update
ON public.meta_whatsapp_contatos FOR UPDATE TO authenticated
USING (public.can_view_meta_contato_folder(auth.uid(), folder_id))
WITH CHECK (public.can_view_meta_contato_folder(auth.uid(), folder_id));

-- Mensagens: leitura e envio nas conversas das caixas do usuário
DROP POLICY IF EXISTS meta_mensagens_folder_member_select ON public.meta_whatsapp_mensagens;
CREATE POLICY meta_mensagens_folder_member_select
ON public.meta_whatsapp_mensagens FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.meta_whatsapp_contatos c
  WHERE c.instancia_id = meta_whatsapp_mensagens.instancia_id
    AND c.telefone IS NOT DISTINCT FROM meta_whatsapp_mensagens.telefone
    AND public.can_view_meta_contato_folder(auth.uid(), c.folder_id)
));

DROP POLICY IF EXISTS meta_mensagens_folder_member_insert ON public.meta_whatsapp_mensagens;
CREATE POLICY meta_mensagens_folder_member_insert
ON public.meta_whatsapp_mensagens FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.meta_whatsapp_contatos c
  WHERE c.instancia_id = meta_whatsapp_mensagens.instancia_id
    AND c.telefone IS NOT DISTINCT FROM meta_whatsapp_mensagens.telefone
    AND public.can_view_meta_contato_folder(auth.uid(), c.folder_id)
));

-- Etiquetas: leitura para responsáveis de caixa
DROP POLICY IF EXISTS meta_etiquetas_folder_member_select ON public.meta_whatsapp_etiquetas;
CREATE POLICY meta_etiquetas_folder_member_select
ON public.meta_whatsapp_etiquetas FOR SELECT TO authenticated
USING (public.has_any_meta_folder_access(auth.uid()));

-- Vínculos de etiqueta: leitura + troca manual nas conversas das caixas do usuário
DROP POLICY IF EXISTS meta_contato_etiquetas_folder_member_select ON public.meta_whatsapp_contato_etiquetas;
CREATE POLICY meta_contato_etiquetas_folder_member_select
ON public.meta_whatsapp_contato_etiquetas FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.meta_whatsapp_contatos c
  WHERE c.id = meta_whatsapp_contato_etiquetas.contato_id
    AND public.can_view_meta_contato_folder(auth.uid(), c.folder_id)
));

DROP POLICY IF EXISTS meta_contato_etiquetas_folder_member_insert ON public.meta_whatsapp_contato_etiquetas;
CREATE POLICY meta_contato_etiquetas_folder_member_insert
ON public.meta_whatsapp_contato_etiquetas FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.meta_whatsapp_contatos c
  WHERE c.id = meta_whatsapp_contato_etiquetas.contato_id
    AND public.can_view_meta_contato_folder(auth.uid(), c.folder_id)
));

DROP POLICY IF EXISTS meta_contato_etiquetas_folder_member_delete ON public.meta_whatsapp_contato_etiquetas;
CREATE POLICY meta_contato_etiquetas_folder_member_delete
ON public.meta_whatsapp_contato_etiquetas FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.meta_whatsapp_contatos c
    WHERE c.id = meta_whatsapp_contato_etiquetas.contato_id
      AND public.can_view_meta_contato_folder(auth.uid(), c.folder_id)
  )
  AND (COALESCE(origem, '') <> 'auto_atendente' OR public.is_admin_user(auth.uid()))
);

-- Fila de atendimento: só etiqueta atendente responsável pela caixa da conversa
CREATE OR REPLACE FUNCTION public.atribuir_atendente_fila()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_contato_id uuid;
  v_folder uuid;
  v_ja_atribuido boolean;
  v_etiqueta uuid;
BEGIN
  IF NEW.direcao <> 'entrada' THEN
    RETURN NEW;
  END IF;

  SELECT id, folder_id INTO v_contato_id, v_folder
  FROM public.meta_whatsapp_contatos
  WHERE instancia_id = NEW.instancia_id
    AND telefone = NEW.telefone
  LIMIT 1;

  IF v_contato_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS(
    SELECT 1
    FROM public.meta_whatsapp_contato_etiquetas ce
    JOIN public.meta_whatsapp_etiquetas e ON e.id = ce.etiqueta_id
    WHERE ce.contato_id = v_contato_id
      AND e.nome ILIKE 'Atendente:%'
  ) INTO v_ja_atribuido;

  IF v_ja_atribuido THEN
    RETURN NEW;
  END IF;

  -- Responsáveis da caixa da conversa (caixa padrão => meta_inbox_default_members)
  WITH responsaveis AS (
    SELECT m.user_id
    FROM public.meta_inbox_folder_members m
    WHERE v_folder IS NOT NULL AND m.folder_id = v_folder
    UNION
    SELECT d.user_id
    FROM public.meta_inbox_default_members d
    WHERE v_folder IS NULL
  ),
  elegiveis AS (
    SELECT f.etiqueta_id, f.ordem
    FROM public.meta_atendimento_fila f
    JOIN public.meta_whatsapp_etiquetas e ON e.id = f.etiqueta_id
    JOIN public.profiles p
      ON lower(btrim(p.nome)) = lower(btrim(regexp_replace(e.nome, '^Atendente:\s*', '', 'i')))
    JOIN responsaveis r ON r.user_id = p.id
    WHERE f.ativo = true
      AND COALESCE(p.ativo, true) = true
  )
  SELECT etiqueta_id INTO v_etiqueta
  FROM elegiveis
  ORDER BY (
    SELECT count(*)
    FROM public.meta_whatsapp_contato_etiquetas ce
    WHERE ce.etiqueta_id = elegiveis.etiqueta_id
  ) ASC, ordem ASC
  LIMIT 1;

  IF v_etiqueta IS NOT NULL THEN
    INSERT INTO public.meta_whatsapp_contato_etiquetas (contato_id, etiqueta_id, origem)
    VALUES (v_contato_id, v_etiqueta, 'auto_atendente')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;