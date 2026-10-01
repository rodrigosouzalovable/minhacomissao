CREATE TABLE public.google_maps_auto_resposta_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  ativo boolean NOT NULL DEFAULT true,
  meta_whatsapps_dia integer NOT NULL DEFAULT 200 CHECK (meta_whatsapps_dia BETWEEN 1 AND 1000),
  max_requisicoes_dia integer NOT NULL DEFAULT 650 CHECK (max_requisicoes_dia BETWEEN 1 AND 650),
  regiao text NOT NULL DEFAULT 'Goiás',
  lock_token uuid,
  lock_expires_at timestamptz,
  ultimo_status text,
  ultimo_erro text,
  ultima_execucao_em timestamptz,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_maps_auto_resposta_config TO authenticated;
GRANT ALL ON public.google_maps_auto_resposta_config TO service_role;
ALTER TABLE public.google_maps_auto_resposta_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage automatic response capture config"
ON public.google_maps_auto_resposta_config FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.google_maps_auto_resposta_candidatos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL UNIQUE REFERENCES public.google_maps_leads(id) ON DELETE CASCADE,
  telefone_normalizado text NOT NULL,
  telefone text NOT NULL,
  nome text,
  nicho text,
  cidade text,
  avaliacao numeric(3,2),
  total_avaliacoes integer,
  site text,
  pontuacao numeric(8,2) NOT NULL DEFAULT 0,
  motivo_pontuacao text,
  status text NOT NULL DEFAULT 'novo' CHECK (status IN ('novo','exportado','em_teste','confirmado')),
  captado_em timestamptz NOT NULL DEFAULT now(),
  exportado_em timestamptz,
  em_teste_em timestamptz,
  confirmado_em timestamptz,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_maps_auto_resposta_candidatos TO authenticated;
GRANT ALL ON public.google_maps_auto_resposta_candidatos TO service_role;
ALTER TABLE public.google_maps_auto_resposta_candidatos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage automatic response candidates"
ON public.google_maps_auto_resposta_candidatos FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE UNIQUE INDEX google_maps_auto_resposta_candidatos_sufixo_uidx
ON public.google_maps_auto_resposta_candidatos (right(regexp_replace(telefone_normalizado, '\D', '', 'g'), 8));
CREATE INDEX google_maps_auto_resposta_candidatos_status_data_idx
ON public.google_maps_auto_resposta_candidatos (status, captado_em DESC);
CREATE INDEX google_maps_auto_resposta_candidatos_nicho_cidade_idx
ON public.google_maps_auto_resposta_candidatos (nicho, cidade);

CREATE OR REPLACE FUNCTION public.gm_auto_resposta_claim(p_token uuid, p_lock_minutes integer DEFAULT 9)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.google_maps_auto_resposta_config
  SET lock_token = p_token,
      lock_expires_at = now() + make_interval(mins => greatest(1, least(coalesce(p_lock_minutes, 9), 30))),
      ultima_execucao_em = now(),
      atualizado_em = now()
  WHERE id = true
    AND ativo = true
    AND (lock_expires_at IS NULL OR lock_expires_at < now() OR lock_token = p_token);
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.gm_auto_resposta_claim(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gm_auto_resposta_claim(uuid, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.gm_auto_resposta_release(p_token uuid, p_status text DEFAULT NULL, p_erro text DEFAULT NULL)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.google_maps_auto_resposta_config
  SET lock_token = NULL,
      lock_expires_at = NULL,
      ultimo_status = coalesce(p_status, ultimo_status),
      ultimo_erro = p_erro,
      atualizado_em = now()
  WHERE id = true AND lock_token = p_token;
$$;
REVOKE ALL ON FUNCTION public.gm_auto_resposta_release(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gm_auto_resposta_release(uuid, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.promover_candidato_auto_resposta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_sufixo text;
BEGIN
  v_sufixo := right(regexp_replace(coalesce(NEW.telefone_normalizado, NEW.telefone, ''), '\D', '', 'g'), 8);
  IF length(v_sufixo) = 8 THEN
    UPDATE public.google_maps_auto_resposta_candidatos
    SET status = 'confirmado', confirmado_em = coalesce(confirmado_em, NEW.ultima_deteccao_em), atualizado_em = now()
    WHERE right(regexp_replace(telefone_normalizado, '\D', '', 'g'), 8) = v_sufixo
      AND status <> 'confirmado';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_promover_candidato_auto_resposta
AFTER INSERT OR UPDATE OF ultima_deteccao_em ON public.meta_aquecimento_auto_respondedores
FOR EACH ROW EXECUTE FUNCTION public.promover_candidato_auto_resposta();

INSERT INTO public.google_maps_auto_resposta_config (id) VALUES (true)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.google_maps_auto_resposta_candidatos IS 'Leads Google Maps com WhatsApp confirmado selecionados para testar a probabilidade de resposta automática.';
COMMENT ON TABLE public.google_maps_auto_resposta_config IS 'Configuração independente da captação de candidatos; não reativa campanhas, Clara, Certificado ou envios.';