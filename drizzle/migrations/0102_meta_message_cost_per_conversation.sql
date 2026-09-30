ALTER TABLE public.meta_whatsapp_mensagens
  ADD COLUMN IF NOT EXISTS origem_envio text,
  ADD COLUMN IF NOT EXISTS pricing_category text,
  ADD COLUMN IF NOT EXISTS pricing_type text,
  ADD COLUMN IF NOT EXISTS foi_gratis boolean;

COMMENT ON COLUMN public.meta_whatsapp_mensagens.origem_envio IS 'Origem operacional do envio: iago, humano, template, campanha ou automacao.';

CREATE TABLE public.meta_mensagem_custos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mensagem_id uuid NOT NULL UNIQUE REFERENCES public.meta_whatsapp_mensagens(id) ON DELETE CASCADE,
  contato_id uuid REFERENCES public.meta_whatsapp_contatos(id) ON DELETE SET NULL,
  instancia_id uuid NOT NULL REFERENCES public.meta_whatsapp_instances(id) ON DELETE CASCADE,
  user_id uuid,
  telefone text,
  wa_message_id text,
  origem text NOT NULL DEFAULT 'outra_automacao',
  categoria text NOT NULL DEFAULT 'SERVICE',
  pricing_type text,
  status text NOT NULL DEFAULT 'estimado' CHECK (status IN ('estimado','confirmado','gratuito','falha')),
  entregue_em timestamptz,
  valor_brl numeric(12,6) NOT NULL DEFAULT 0,
  valor_usd numeric(12,6) NOT NULL DEFAULT 0,
  fx_rate numeric(12,6) NOT NULL DEFAULT 5.50,
  mes_referencia date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.meta_mensagem_custos TO authenticated;
GRANT ALL ON public.meta_mensagem_custos TO service_role;
ALTER TABLE public.meta_mensagem_custos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuarios veem custos de conversas acessiveis"
ON public.meta_mensagem_custos FOR SELECT TO authenticated
USING (
  contato_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.meta_whatsapp_contatos c
    WHERE c.id = contato_id
      AND public.can_view_meta_contato_folder(auth.uid(), c.folder_id)
  )
);
CREATE INDEX idx_meta_mensagem_custos_contato_mes ON public.meta_mensagem_custos (contato_id, mes_referencia, entregue_em DESC);
CREATE INDEX idx_meta_mensagem_custos_instancia_mes ON public.meta_mensagem_custos (instancia_id, mes_referencia, categoria, status);
CREATE INDEX idx_meta_mensagem_custos_wamid ON public.meta_mensagem_custos (wa_message_id) WHERE wa_message_id IS NOT NULL;

CREATE TABLE public.meta_tarifas_mensagem (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pais text NOT NULL,
  categoria text NOT NULL,
  vigencia_inicio date NOT NULL,
  valor_brl numeric(12,6) NOT NULL,
  valor_usd numeric(12,6),
  franquia_mensal integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pais, categoria, vigencia_inicio)
);
GRANT SELECT ON public.meta_tarifas_mensagem TO authenticated;
GRANT ALL ON public.meta_tarifas_mensagem TO service_role;
ALTER TABLE public.meta_tarifas_mensagem ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuarios autenticados veem tarifas Meta"
ON public.meta_tarifas_mensagem FOR SELECT TO authenticated USING (true);

INSERT INTO public.meta_tarifas_mensagem (pais, categoria, vigencia_inicio, valor_brl, valor_usd, franquia_mensal)
VALUES
  ('BR','SERVICE','2026-10-01',0.0350,0.0068,1000),
  ('BR','UTILITY','2026-10-01',0.0350,0.0068,0),
  ('BR','AUTHENTICATION','2026-10-01',0.0350,0.0068,0),
  ('BR','MARKETING','2026-10-01',0.3217,0.0625,0)
ON CONFLICT (pais, categoria, vigencia_inicio) DO NOTHING;

CREATE OR REPLACE FUNCTION public.registrar_custo_mensagem_meta(
  p_wa_message_id text,
  p_status text,
  p_categoria text DEFAULT NULL,
  p_pricing_type text DEFAULT NULL,
  p_foi_gratis boolean DEFAULT NULL,
  p_entregue_em timestamptz DEFAULT now()
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_msg public.meta_whatsapp_mensagens%ROWTYPE;
  v_contato_id uuid;
  v_categoria text;
  v_origem text;
  v_valor_brl numeric(12,6) := 0;
  v_valor_usd numeric(12,6) := 0;
  v_status text := 'estimado';
  v_mes date;
  v_franquia integer := 0;
  v_usadas bigint := 0;
BEGIN
  SELECT * INTO v_msg FROM public.meta_whatsapp_mensagens WHERE wa_message_id = p_wa_message_id LIMIT 1;
  IF v_msg.id IS NULL OR v_msg.direcao <> 'saida' THEN RETURN; END IF;

  SELECT id INTO v_contato_id FROM public.meta_whatsapp_contatos
  WHERE instancia_id = v_msg.instancia_id
    AND (
      (v_msg.bsuid IS NOT NULL AND bsuid = v_msg.bsuid)
      OR (v_msg.telefone IS NOT NULL AND right(regexp_replace(telefone,'\D','','g'),8) = right(regexp_replace(v_msg.telefone,'\D','','g'),8))
    )
  ORDER BY atualizado_em DESC LIMIT 1;

  v_categoria := upper(coalesce(nullif(p_categoria,''), nullif(v_msg.pricing_category,''), CASE WHEN v_msg.template_nome IS NULL THEN 'SERVICE' ELSE 'UTILITY' END));
  v_origem := coalesce(nullif(v_msg.origem_envio,''), CASE WHEN v_msg.template_nome IS NOT NULL THEN 'template' ELSE 'humano' END);
  v_mes := date_trunc('month', p_entregue_em AT TIME ZONE 'America/Sao_Paulo')::date;

  IF p_status = 'failed' THEN
    v_status := 'falha';
  ELSIF p_status IN ('delivered','read') THEN
    v_status := 'confirmado';
    IF coalesce(p_foi_gratis,false) THEN
      v_status := 'gratuito';
    ELSIF v_categoria = 'SERVICE' AND p_entregue_em < '2026-10-01 03:00:00+00'::timestamptz THEN
      v_status := 'gratuito';
    ELSE
      SELECT valor_brl, coalesce(valor_usd,0), franquia_mensal
      INTO v_valor_brl, v_valor_usd, v_franquia
      FROM public.meta_tarifas_mensagem
      WHERE pais='BR' AND categoria=v_categoria AND vigencia_inicio <= (p_entregue_em AT TIME ZONE 'America/Sao_Paulo')::date
      ORDER BY vigencia_inicio DESC LIMIT 1;

      IF v_categoria='SERVICE' AND v_franquia > 0 THEN
        SELECT count(*) INTO v_usadas FROM public.meta_mensagem_custos
        WHERE instancia_id=v_msg.instancia_id AND mes_referencia=v_mes AND categoria='SERVICE'
          AND status IN ('confirmado','gratuito') AND mensagem_id <> v_msg.id;
        IF v_usadas < v_franquia THEN
          v_status := 'gratuito'; v_valor_brl := 0; v_valor_usd := 0;
        END IF;
      END IF;
    END IF;
  END IF;

  INSERT INTO public.meta_mensagem_custos (
    mensagem_id, contato_id, instancia_id, user_id, telefone, wa_message_id,
    origem, categoria, pricing_type, status, entregue_em, valor_brl, valor_usd,
    fx_rate, mes_referencia, updated_at
  ) VALUES (
    v_msg.id, v_contato_id, v_msg.instancia_id, v_msg.user_id, v_msg.telefone, p_wa_message_id,
    v_origem, v_categoria, p_pricing_type, v_status,
    CASE WHEN p_status IN ('delivered','read') THEN p_entregue_em ELSE NULL END,
    v_valor_brl, v_valor_usd, 5.50, v_mes, now()
  ) ON CONFLICT (mensagem_id) DO UPDATE SET
    contato_id=excluded.contato_id,
    origem=excluded.origem,
    categoria=excluded.categoria,
    pricing_type=coalesce(excluded.pricing_type, public.meta_mensagem_custos.pricing_type),
    status=CASE WHEN public.meta_mensagem_custos.status='confirmado' AND excluded.status='estimado' THEN public.meta_mensagem_custos.status ELSE excluded.status END,
    entregue_em=coalesce(public.meta_mensagem_custos.entregue_em, excluded.entregue_em),
    valor_brl=excluded.valor_brl,
    valor_usd=excluded.valor_usd,
    updated_at=now();
END;
$$;
REVOKE ALL ON FUNCTION public.registrar_custo_mensagem_meta(text,text,text,text,boolean,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_custo_mensagem_meta(text,text,text,text,boolean,timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.meta_conversa_custo_resumo(p_contato_id uuid, p_mes date DEFAULT date_trunc('month', timezone('America/Sao_Paulo', now()))::date)
RETURNS TABLE(valor_brl numeric, entregues bigint, cobradas bigint, gratuitas bigint, custo_iago numeric, custo_humano numeric, custo_outros numeric, confirmado boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $$
  SELECT
    coalesce(sum(c.valor_brl),0),
    count(*) FILTER (WHERE c.status IN ('confirmado','gratuito')),
    count(*) FILTER (WHERE c.status='confirmado' AND c.valor_brl > 0),
    count(*) FILTER (WHERE c.status='gratuito'),
    coalesce(sum(c.valor_brl) FILTER (WHERE c.origem='iago'),0),
    coalesce(sum(c.valor_brl) FILTER (WHERE c.origem='humano'),0),
    coalesce(sum(c.valor_brl) FILTER (WHERE c.origem NOT IN ('iago','humano')),0),
    count(*) FILTER (WHERE c.status='estimado') = 0
  FROM public.meta_mensagem_custos c
  JOIN public.meta_whatsapp_contatos ct ON ct.id=c.contato_id
  WHERE c.contato_id=p_contato_id AND c.mes_referencia=date_trunc('month',p_mes)::date
    AND public.can_view_meta_contato_folder(auth.uid(), ct.folder_id)
$$;
GRANT EXECUTE ON FUNCTION public.meta_conversa_custo_resumo(uuid,date) TO authenticated;

CREATE OR REPLACE FUNCTION public.meta_conversa_custo_detalhes(p_contato_id uuid, p_mes date DEFAULT date_trunc('month', timezone('America/Sao_Paulo', now()))::date)
RETURNS TABLE(id uuid, mensagem_id uuid, entregue_em timestamptz, origem text, categoria text, status text, valor_brl numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $$
  SELECT c.id,c.mensagem_id,c.entregue_em,c.origem,c.categoria,c.status,c.valor_brl
  FROM public.meta_mensagem_custos c
  JOIN public.meta_whatsapp_contatos ct ON ct.id=c.contato_id
  WHERE c.contato_id=p_contato_id AND c.mes_referencia=date_trunc('month',p_mes)::date
    AND public.can_view_meta_contato_folder(auth.uid(), ct.folder_id)
  ORDER BY c.entregue_em DESC NULLS LAST
$$;
GRANT EXECUTE ON FUNCTION public.meta_conversa_custo_detalhes(uuid,date) TO authenticated;