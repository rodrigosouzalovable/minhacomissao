CREATE OR REPLACE FUNCTION public.meta_fila_status_caixa(_folder uuid DEFAULT NULL::uuid)
 RETURNS TABLE(user_id uuid, na_fila boolean)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT p.id AS user_id,
         (EXISTS (
            SELECT 1 FROM public.meta_atendimento_fila f
            JOIN public.meta_whatsapp_etiquetas e ON e.id = f.etiqueta_id
            WHERE f.ativo = true AND e.nome ILIKE 'Atendente:%'
              AND (f.user_id = p.id OR lower(btrim(e.nome)) = lower('Atendente: ' || btrim(p.nome)))
         )
          AND COALESCE((SELECT up.atende_inbox_meta FROM public.user_permissions up WHERE up.user_id = p.id), false) = true) AS na_fila
  FROM public.profiles p
  WHERE ((_folder IS NOT NULL AND EXISTS (SELECT 1 FROM public.meta_inbox_folder_members m WHERE m.folder_id = _folder AND m.user_id = p.id))
      OR (_folder IS NULL AND EXISTS (SELECT 1 FROM public.meta_inbox_default_members d WHERE d.user_id = p.id)))
  AND (CASE WHEN _folder IS NULL THEN public.meta_inbox_default_can_manage(auth.uid())
            ELSE public.meta_inbox_folder_can_manage(auth.uid(), _folder) END);
$function$;

CREATE OR REPLACE FUNCTION public.meta_provisionar_atendentes_fila(_folder uuid DEFAULT NULL::uuid)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_cores text[] := ARRAY['#25D366','#FF6B6B','#4ECDC4','#FFD93D','#6C5CE7','#FF8A5C','#EA4C89','#00B4D8'];
  r RECORD; v_etq uuid; v_count integer := 0; v_ordem integer;
BEGIN
  FOR r IN
    SELECT p.id AS user_id, btrim(p.nome) AS nome FROM public.profiles p
    WHERE COALESCE(p.ativo, true) = true AND btrim(COALESCE(p.nome,'')) <> ''
      AND ((_folder IS NOT NULL AND EXISTS (SELECT 1 FROM public.meta_inbox_folder_members m WHERE m.folder_id = _folder AND m.user_id = p.id))
        OR (_folder IS NULL AND EXISTS (SELECT 1 FROM public.meta_inbox_default_members d WHERE d.user_id = p.id)))
  LOOP
    v_etq := NULL;
    -- 1) etiqueta de atendente já ligada a este usuário na fila (mesmo com nome antigo)
    SELECT f.etiqueta_id INTO v_etq FROM public.meta_atendimento_fila f
      JOIN public.meta_whatsapp_etiquetas e ON e.id = f.etiqueta_id
      WHERE f.user_id = r.user_id AND e.nome ILIKE 'Atendente:%' ORDER BY f.ativo DESC LIMIT 1;
    IF v_etq IS NULL THEN
      SELECT e.id INTO v_etq FROM public.meta_whatsapp_etiquetas e
      WHERE lower(btrim(e.nome)) = lower('Atendente: ' || r.nome) LIMIT 1;
    END IF;
    IF v_etq IS NULL THEN
      INSERT INTO public.meta_whatsapp_etiquetas (user_id, nome, cor)
      VALUES (r.user_id, 'Atendente: ' || r.nome, v_cores[1 + (abs(hashtext(r.nome)) % array_length(v_cores,1))])
      RETURNING id INTO v_etq;
      v_count := v_count + 1;
    END IF;
    UPDATE public.meta_whatsapp_etiquetas SET ativa = true WHERE id = v_etq AND ativa IS DISTINCT FROM true;
    IF NOT EXISTS (SELECT 1 FROM public.meta_atendimento_fila f WHERE f.etiqueta_id = v_etq) THEN
      SELECT COALESCE(MAX(ordem),0) + 1 INTO v_ordem FROM public.meta_atendimento_fila;
      INSERT INTO public.meta_atendimento_fila (etiqueta_id, user_id, ordem, ativo) VALUES (v_etq, r.user_id, v_ordem, true);
      v_count := v_count + 1;
    ELSE
      UPDATE public.meta_atendimento_fila SET ativo = true, user_id = r.user_id
      WHERE etiqueta_id = v_etq AND (ativo IS DISTINCT FROM true OR user_id IS DISTINCT FROM r.user_id);
    END IF;
    IF EXISTS (SELECT 1 FROM public.user_permissions up WHERE up.user_id = r.user_id) THEN
      UPDATE public.user_permissions SET atende_inbox_meta = true, atualizado_em = now()
      WHERE user_id = r.user_id AND atende_inbox_meta IS DISTINCT FROM true;
    ELSE
      INSERT INTO public.user_permissions (user_id, atende_inbox_meta) VALUES (r.user_id, true);
    END IF;
  END LOOP;
  RETURN v_count;
END;
$function$;

SELECT public.meta_provisionar_atendentes_fila('1a7e7a7c-f684-441d-af99-0ded7b979f49'::uuid);