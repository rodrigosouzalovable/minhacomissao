CREATE OR REPLACE FUNCTION public.blacklist_aquecimento_auto_respondedor(_respondedor_id uuid)
RETURNS TABLE(telefone_sufixo text, telefone text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_respondedor public.meta_aquecimento_auto_respondedores%ROWTYPE;
  v_origem_user_id uuid;
  v_telefone text;
  v_sufixo text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem adicionar contatos à blacklist';
  END IF;

  SELECT mar.*
    INTO v_respondedor
    FROM public.meta_aquecimento_auto_respondedores AS mar
   WHERE mar.id = _respondedor_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contato não encontrado';
  END IF;

  v_telefone := regexp_replace(COALESCE(v_respondedor.telefone_normalizado, v_respondedor.telefone, ''), '\D', '', 'g');
  IF length(v_telefone) < 8 THEN
    RAISE EXCEPTION 'Telefone inválido para blacklist';
  END IF;
  v_sufixo := right(v_telefone, 8);

  IF v_respondedor.instancia_id IS NOT NULL THEN
    SELECT mwi.user_id
      INTO v_origem_user_id
      FROM public.meta_whatsapp_instances AS mwi
     WHERE mwi.id = v_respondedor.instancia_id;
  END IF;

  INSERT INTO public.meta_destinatario_supressao AS mds (
    telefone_sufixo,
    telefone,
    motivo,
    categoria,
    instancia_id,
    origem_user_id,
    contato_nome,
    origem_texto,
    criado_em,
    atualizado_em
  ) VALUES (
    v_sufixo,
    v_telefone,
    'blacklist: bloqueado manualmente no Aquecimento Meta',
    'blacklist',
    v_respondedor.instancia_id,
    v_origem_user_id,
    v_respondedor.nome,
    'Aquecimento Meta · Google Maps',
    now(),
    now()
  )
  ON CONFLICT ON CONSTRAINT meta_destinatario_supressao_pkey DO UPDATE SET
    telefone = EXCLUDED.telefone,
    motivo = EXCLUDED.motivo,
    categoria = 'blacklist',
    instancia_id = COALESCE(EXCLUDED.instancia_id, mds.instancia_id),
    origem_user_id = COALESCE(EXCLUDED.origem_user_id, mds.origem_user_id),
    contato_nome = COALESCE(EXCLUDED.contato_nome, mds.contato_nome),
    origem_texto = EXCLUDED.origem_texto,
    atualizado_em = now();

  DELETE FROM public.meta_aquecimento_auto_respondedores AS mar
   WHERE mar.id = _respondedor_id;

  RETURN QUERY
  SELECT v_sufixo AS telefone_sufixo, v_telefone AS telefone;
END;
$$;

REVOKE ALL ON FUNCTION public.blacklist_aquecimento_auto_respondedor(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.blacklist_aquecimento_auto_respondedor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.blacklist_aquecimento_auto_respondedor(uuid) TO service_role;