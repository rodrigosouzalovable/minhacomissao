ALTER TABLE public.cliente_usa_config ADD COLUMN IF NOT EXISTS idioma_interface text NOT NULL DEFAULT 'en';

CREATE OR REPLACE FUNCTION public.garantir_caixa_cliente_usa(_user_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_id uuid; v_nome text;
BEGIN
  SELECT id INTO v_id FROM public.meta_inbox_folders WHERE owner_id = _user_id ORDER BY created_at LIMIT 1;
  IF v_id IS NULL THEN
    SELECT coalesce(nullif(nome,''), 'Client') INTO v_nome FROM public.profiles WHERE id = _user_id;
    INSERT INTO public.meta_inbox_folders(nome, owner_id) VALUES ('My Inbox – ' || coalesce(v_nome,'Client'), _user_id) RETURNING id INTO v_id;
  END IF;
  INSERT INTO public.meta_inbox_folder_members(folder_id, user_id) VALUES (v_id, _user_id) ON CONFLICT DO NOTHING;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.garantir_caixa_cliente_usa(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_definir_cliente_usa(_user_id uuid, _usa_b2b boolean, _teste boolean, _dias_extra integer DEFAULT 0)
 RETURNS cliente_usa_config LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r public.cliente_usa_config;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Apenas admin'; END IF;
  INSERT INTO public.cliente_usa_config(user_id) VALUES (_user_id) ON CONFLICT (user_id) DO NOTHING;
  UPDATE public.cliente_usa_config SET
    usa_b2b = _usa_b2b,
    teste_ate = CASE
      WHEN NOT _teste THEN NULL
      WHEN _dias_extra > 0 THEN greatest(coalesce(teste_ate, now()), now()) + make_interval(days => _dias_extra)
      WHEN teste_ate IS NULL THEN now() + interval '3 days'
      ELSE teste_ate END,
    respostas_usadas = CASE WHEN _teste AND teste_ate IS NULL THEN 0 ELSE respostas_usadas END
  WHERE user_id = _user_id RETURNING * INTO r;
  IF _usa_b2b THEN
    INSERT INTO public.user_permissions(user_id, abas_permitidas) VALUES (_user_id, ARRAY['/cliente-usa','/inbox','/conta'])
    ON CONFLICT (user_id) DO UPDATE SET abas_permitidas = ARRAY['/cliente-usa','/inbox','/conta'], atualizado_em = now();
    PERFORM public.garantir_caixa_cliente_usa(_user_id);
  END IF;
  RETURN r;
END $function$;

SELECT public.garantir_caixa_cliente_usa(user_id) FROM public.cliente_usa_config WHERE usa_b2b;