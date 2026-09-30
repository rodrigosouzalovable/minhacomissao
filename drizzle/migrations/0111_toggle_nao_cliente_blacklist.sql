CREATE OR REPLACE FUNCTION public.marcar_meta_contato_nao_cliente(_contato_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_contato public.meta_whatsapp_contatos%ROWTYPE;
  v_sufixo text;
  v_caixa_nome text;
  v_motivo_existente text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT * INTO v_contato
  FROM public.meta_whatsapp_contatos c
  WHERE c.id = _contato_id
    AND public.can_access_meta_folder(auth.uid(), c.folder_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'Conversa não encontrada ou sem acesso'; END IF;

  v_sufixo := right(regexp_replace(coalesce(v_contato.telefone, ''), '\D', '', 'g'), 8);
  IF length(v_sufixo) < 8 THEN RAISE EXCEPTION 'Telefone inválido'; END IF;

  SELECT motivo INTO v_motivo_existente
  FROM public.meta_destinatario_supressao
  WHERE telefone_sufixo = v_sufixo
  FOR UPDATE;

  IF v_motivo_existente = 'blacklist: não é o cliente' THEN
    DELETE FROM public.meta_destinatario_supressao
    WHERE telefone_sufixo = v_sufixo AND motivo = 'blacklist: não é o cliente';
    RETURN jsonb_build_object('acao', 'desfeito', 'telefone_sufixo', v_sufixo);
  ELSIF v_motivo_existente IS NOT NULL THEN
    RETURN jsonb_build_object('acao', 'ja_bloqueado', 'telefone_sufixo', v_sufixo);
  END IF;

  IF v_contato.folder_id IS NULL THEN v_caixa_nome := 'PADRÃO';
  ELSE SELECT f.nome INTO v_caixa_nome FROM public.meta_inbox_folders f WHERE f.id = v_contato.folder_id;
  END IF;

  INSERT INTO public.meta_destinatario_supressao (
    telefone_sufixo, telefone, motivo, falhas, criado_em, atualizado_em,
    instancia_id, origem_user_id, contato_nome, caixa_id, caixa_nome, origem_texto
  ) VALUES (
    v_sufixo, regexp_replace(coalesce(v_contato.telefone, ''), '\D', '', 'g'),
    'blacklist: não é o cliente', 1, now(), now(), v_contato.instancia_id, auth.uid(),
    coalesce(nullif(btrim(v_contato.nome_perfil), ''), nullif(btrim(v_contato.nome), '')),
    v_contato.folder_id, coalesce(v_caixa_nome, 'PADRÃO'),
    'Marcado manualmente no Inbox Meta como Não é o cliente'
  );
  RETURN jsonb_build_object('acao', 'marcado', 'telefone_sufixo', v_sufixo, 'telefone', v_contato.telefone);
END;
$$;

REVOKE ALL ON FUNCTION public.marcar_meta_contato_nao_cliente(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.marcar_meta_contato_nao_cliente(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.desfazer_meta_contato_nao_cliente(_telefone_sufixo text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_sufixo text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  v_sufixo := right(regexp_replace(coalesce(_telefone_sufixo, ''), '\D', '', 'g'), 8);
  DELETE FROM public.meta_destinatario_supressao
  WHERE telefone_sufixo = v_sufixo AND motivo = 'blacklist: não é o cliente';
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.desfazer_meta_contato_nao_cliente(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.desfazer_meta_contato_nao_cliente(text) TO authenticated;