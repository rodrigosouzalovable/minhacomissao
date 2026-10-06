CREATE OR REPLACE FUNCTION public.salvar_link_botao_meta(_template_id uuid, _link text)
RETURNS TABLE(template_id uuid)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_name text;
  v_language text;
  v_link text := btrim(_link);
  v_row record;
  v_component jsonb;
  v_button jsonb;
  v_url text;
  v_base text;
  v_seen boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão inválida'; END IF;
  IF v_link IS NULL OR length(v_link) > 2048 OR v_link !~* '^https://[^/?#[:space:]@\\]+([/?#].*)?$' OR v_link ~ '[[:space:]\\]' OR position('{{' in v_link) > 0 THEN
    RAISE EXCEPTION 'Informe um link HTTPS completo, sem espaços ou credenciais';
  END IF;
  SELECT i.user_id, t.nome_template, t.idioma INTO v_owner, v_name, v_language
  FROM public.meta_whatsapp_templates t JOIN public.meta_whatsapp_instances i ON i.id = t.instancia_id
  WHERE t.id = _template_id;
  IF v_owner IS NULL OR (v_owner <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Sem permissão para alterar o link deste modelo';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_owner::text || ':' || v_name || ':' || coalesce(v_language, ''), 0));
  FOR v_row IN
    SELECT t.id, t.variaveis FROM public.meta_whatsapp_templates t
    JOIN public.meta_whatsapp_instances i ON i.id = t.instancia_id
    WHERE i.user_id = v_owner AND t.nome_template = v_name AND t.idioma IS NOT DISTINCT FROM v_language
    FOR UPDATE OF t
  LOOP
    FOR v_component IN SELECT value FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_row.variaveis->'_components') = 'array' THEN v_row.variaveis->'_components' ELSE '[]'::jsonb END)
    LOOP
      IF upper(v_component->>'type') <> 'BUTTONS' THEN CONTINUE; END IF;
      FOR v_button IN SELECT value FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_component->'buttons') = 'array' THEN v_component->'buttons' ELSE '[]'::jsonb END)
      LOOP
        v_url := v_button->>'url';
        IF upper(v_button->>'type') <> 'URL' OR position('{{' in coalesce(v_url,'')) = 0 THEN CONTINUE; END IF;
        v_seen := true;
        IF v_url !~ '^.*\{\{[[:space:]]*[0-9]+[[:space:]]*\}\}$' THEN
          RAISE EXCEPTION 'A URL dinâmica registrada na Meta não permite preservar este destino';
        END IF;
        v_base := regexp_replace(v_url, '\{\{[[:space:]]*[0-9]+[[:space:]]*\}\}$', '');
        IF position('{{' in v_base) > 0 OR NOT (
          (v_base <> '' AND left(v_link, length(v_base)) = v_base AND length(v_link) > length(v_base))
          OR v_base ~* '^https://(www\.)?meusacordos\.com\.br/(%7B%7B(%20)*[0-9]+(%20)*%7D%7D)?$'
        ) THEN
          RAISE EXCEPTION 'O link não é compatível com a URL fixa deste modelo na Meta';
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
  IF NOT v_seen THEN RAISE EXCEPTION 'Este modelo não possui botão com URL dinâmica'; END IF;
  RETURN QUERY
    UPDATE public.meta_whatsapp_templates t
    SET variaveis = coalesce(t.variaveis, '{}'::jsonb) || jsonb_build_object('_button_url', v_link, '_button_url_live', true)
    FROM public.meta_whatsapp_instances i
    WHERE i.id = t.instancia_id AND i.user_id = v_owner
      AND t.nome_template = v_name AND t.idioma IS NOT DISTINCT FROM v_language
    RETURNING t.id;
END;
$$;
REVOKE ALL ON FUNCTION public.salvar_link_botao_meta(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salvar_link_botao_meta(uuid, text) TO authenticated;