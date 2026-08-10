CREATE OR REPLACE FUNCTION public.atribuir_atendente_fila()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contato_id uuid;
  v_folder uuid;
  v_ja_atribuido boolean;
  v_etiqueta uuid;
  v_iniciada_por_nos boolean;
  v_inicio_dia timestamptz;
BEGIN
  IF NEW.direcao <> 'entrada' THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.meta_whatsapp_mensagens m
    WHERE m.instancia_id = NEW.instancia_id
      AND m.telefone = NEW.telefone
      AND m.direcao = 'saida'
  ) INTO v_iniciada_por_nos;

  IF v_iniciada_por_nos THEN
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

  -- Início do dia no fuso de Brasília
  v_inicio_dia := ((now() AT TIME ZONE 'America/Sao_Paulo')::date::timestamp
                    AT TIME ZONE 'America/Sao_Paulo');

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
      AND ce.criado_em >= v_inicio_dia
  ) ASC, elegiveis.ordem ASC
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