ALTER TABLE public.meta_whatsapp_instances ADD COLUMN IF NOT EXISTS excluida_em timestamptz, ADD COLUMN IF NOT EXISTS excluida_por uuid;

REVOKE DELETE ON public.meta_whatsapp_instances FROM authenticated;

CREATE OR REPLACE FUNCTION public.excluir_meta_instancia(_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _dono uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Sessão necessária'; END IF;
  SELECT user_id INTO _dono FROM public.meta_whatsapp_instances WHERE id = _id AND excluida_em IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Instância não encontrada'; END IF;
  IF _dono IS DISTINCT FROM _uid AND NOT public.has_role(_uid, 'admin') THEN
    RAISE EXCEPTION 'Você só pode excluir instâncias que cadastrou';
  END IF;
  UPDATE public.meta_whatsapp_instances
     SET ativo = false, recuperacao_ativa = false, aquecimento_meta_ativo = false,
         excluida_em = now(), excluida_por = _uid
   WHERE id = _id;
  RETURN jsonb_build_object('ok', true);
END $$;

REVOKE ALL ON FUNCTION public.excluir_meta_instancia(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.excluir_meta_instancia(uuid) TO authenticated;