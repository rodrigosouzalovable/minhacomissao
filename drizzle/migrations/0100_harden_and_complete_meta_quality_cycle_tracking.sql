REVOKE ALL ON public.meta_qualidade_recuperacao_ciclos FROM anon;

CREATE OR REPLACE FUNCTION public.registrar_ciclo_qualidade_meta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_anterior text := upper(coalesce(OLD.saude_quality, ''));
  v_atual text := upper(coalesce(NEW.saude_quality, ''));
  v_momento timestamp with time zone := coalesce(NEW.saude_checked_at, now());
  v_ciclo_id uuid;
BEGIN
  IF v_atual IN ('YELLOW', 'RED') AND v_anterior IS DISTINCT FROM v_atual THEN
    SELECT id INTO v_ciclo_id
    FROM public.meta_qualidade_recuperacao_ciclos
    WHERE instancia_id = NEW.id AND voltou_green_em IS NULL
    LIMIT 1;

    IF v_ciclo_id IS NULL THEN
      INSERT INTO public.meta_qualidade_recuperacao_ciclos (
        instancia_id, user_id, qualidade_origem, caiu_em,
        aquecimento_ativado_em, precisao
      ) VALUES (
        NEW.id, NEW.user_id, v_atual, v_momento,
        CASE WHEN NEW.recuperacao_ativa IS TRUE THEN v_momento ELSE NULL END,
        'exata'
      );
    ELSE
      UPDATE public.meta_qualidade_recuperacao_ciclos
      SET qualidade_origem = v_atual,
          aquecimento_ativado_em = coalesce(
            aquecimento_ativado_em,
            CASE WHEN NEW.recuperacao_ativa IS TRUE THEN v_momento ELSE NULL END
          ),
          atualizado_em = now()
      WHERE id = v_ciclo_id;
    END IF;
  END IF;

  IF v_atual IN ('YELLOW', 'RED') AND NEW.recuperacao_ativa IS TRUE
     AND OLD.recuperacao_ativa IS DISTINCT FROM TRUE THEN
    UPDATE public.meta_qualidade_recuperacao_ciclos
    SET aquecimento_ativado_em = coalesce(aquecimento_ativado_em, v_momento),
        atualizado_em = now()
    WHERE instancia_id = NEW.id AND voltou_green_em IS NULL;

    IF NOT FOUND THEN
      INSERT INTO public.meta_qualidade_recuperacao_ciclos (
        instancia_id, user_id, qualidade_origem, caiu_em,
        aquecimento_ativado_em, precisao
      ) VALUES (
        NEW.id, NEW.user_id, v_atual,
        coalesce(NEW.recuperacao_desde, v_momento),
        v_momento, 'historico_parcial'
      );
    END IF;
  END IF;

  IF v_atual = 'GREEN' AND v_anterior IS DISTINCT FROM 'GREEN' THEN
    UPDATE public.meta_qualidade_recuperacao_ciclos
    SET voltou_green_em = v_momento,
        atualizado_em = now()
    WHERE instancia_id = NEW.id AND voltou_green_em IS NULL;
  END IF;

  RETURN NEW;
END;
$$;