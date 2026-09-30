CREATE TABLE public.meta_qualidade_recuperacao_ciclos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instancia_id uuid NOT NULL REFERENCES public.meta_whatsapp_instances(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  qualidade_origem text NOT NULL,
  caiu_em timestamp with time zone NOT NULL,
  aquecimento_ativado_em timestamp with time zone,
  primeiro_envio_uazapi_em timestamp with time zone,
  voltou_green_em timestamp with time zone,
  envios_uazapi_aceitos integer NOT NULL DEFAULT 0,
  precisao text NOT NULL DEFAULT 'exata',
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  atualizado_em timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT meta_qualidade_recuperacao_qualidade_check CHECK (qualidade_origem IN ('YELLOW', 'RED')),
  CONSTRAINT meta_qualidade_recuperacao_precisao_check CHECK (precisao IN ('exata', 'historico_parcial'))
);

GRANT SELECT ON public.meta_qualidade_recuperacao_ciclos TO authenticated;
GRANT ALL ON public.meta_qualidade_recuperacao_ciclos TO service_role;

ALTER TABLE public.meta_qualidade_recuperacao_ciclos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Proprietario e administradores veem ciclos de recuperacao"
ON public.meta_qualidade_recuperacao_ciclos
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE UNIQUE INDEX meta_qualidade_recuperacao_um_ciclo_aberto_idx
ON public.meta_qualidade_recuperacao_ciclos (instancia_id)
WHERE voltou_green_em IS NULL;

CREATE INDEX meta_qualidade_recuperacao_user_green_idx
ON public.meta_qualidade_recuperacao_ciclos (user_id, voltou_green_em DESC);

CREATE INDEX meta_qualidade_recuperacao_instancia_queda_idx
ON public.meta_qualidade_recuperacao_ciclos (instancia_id, caiu_em DESC);

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

  IF v_atual = 'GREEN' AND v_anterior IN ('YELLOW', 'RED') THEN
    UPDATE public.meta_qualidade_recuperacao_ciclos
    SET voltou_green_em = v_momento,
        atualizado_em = now()
    WHERE instancia_id = NEW.id AND voltou_green_em IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER registrar_ciclo_qualidade_meta_trigger
AFTER UPDATE OF saude_quality, recuperacao_ativa ON public.meta_whatsapp_instances
FOR EACH ROW
EXECUTE FUNCTION public.registrar_ciclo_qualidade_meta();

CREATE OR REPLACE FUNCTION public.registrar_envio_ciclo_recuperacao_meta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'enviado' THEN
    UPDATE public.meta_qualidade_recuperacao_ciclos
    SET primeiro_envio_uazapi_em = coalesce(primeiro_envio_uazapi_em, NEW.enviado_em),
        envios_uazapi_aceitos = envios_uazapi_aceitos + 1,
        atualizado_em = now()
    WHERE instancia_id = NEW.instancia_id AND voltou_green_em IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER registrar_envio_ciclo_recuperacao_meta_trigger
AFTER INSERT ON public.meta_recuperacao_log
FOR EACH ROW
EXECUTE FUNCTION public.registrar_envio_ciclo_recuperacao_meta();

INSERT INTO public.meta_qualidade_recuperacao_ciclos (
  instancia_id, user_id, qualidade_origem, caiu_em,
  aquecimento_ativado_em, primeiro_envio_uazapi_em,
  envios_uazapi_aceitos, precisao
)
SELECT
  i.id,
  i.user_id,
  upper(i.saude_quality),
  coalesce(i.recuperacao_desde, i.saude_checked_at, now()),
  i.recuperacao_desde,
  l.primeiro_envio,
  coalesce(l.total_envios, 0),
  'historico_parcial'
FROM public.meta_whatsapp_instances i
LEFT JOIN LATERAL (
  SELECT min(r.enviado_em) AS primeiro_envio, count(*)::integer AS total_envios
  FROM public.meta_recuperacao_log r
  WHERE r.instancia_id = i.id
    AND r.status = 'enviado'
    AND r.enviado_em >= coalesce(i.recuperacao_desde, i.saude_checked_at, '-infinity'::timestamp with time zone)
) l ON true
WHERE i.recuperacao_ativa IS TRUE
  AND upper(coalesce(i.saude_quality, '')) IN ('YELLOW', 'RED')
  AND NOT EXISTS (
    SELECT 1 FROM public.meta_qualidade_recuperacao_ciclos c
    WHERE c.instancia_id = i.id AND c.voltou_green_em IS NULL
  );