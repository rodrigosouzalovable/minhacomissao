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
  v_evento_em timestamptz := coalesce(p_entregue_em, now());
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
  v_mes := date_trunc('month', v_evento_em AT TIME ZONE 'America/Sao_Paulo')::date;

  SELECT valor_brl, coalesce(valor_usd,0), franquia_mensal
  INTO v_valor_brl, v_valor_usd, v_franquia
  FROM public.meta_tarifas_mensagem
  WHERE pais='BR' AND categoria=v_categoria AND vigencia_inicio <= (v_evento_em AT TIME ZONE 'America/Sao_Paulo')::date
  ORDER BY vigencia_inicio DESC LIMIT 1;

  IF p_status = 'failed' THEN
    v_status := 'falha';
    v_valor_brl := 0;
    v_valor_usd := 0;
  ELSIF p_status IN ('delivered','read') THEN
    v_status := 'confirmado';
    IF coalesce(p_foi_gratis,false) THEN
      v_status := 'gratuito';
      v_valor_brl := 0;
      v_valor_usd := 0;
    ELSIF v_categoria = 'SERVICE' AND v_evento_em < '2026-10-01 03:00:00+00'::timestamptz THEN
      v_status := 'gratuito';
      v_valor_brl := 0;
      v_valor_usd := 0;
    ELSIF v_categoria='SERVICE' AND v_franquia > 0 THEN
      SELECT count(*) INTO v_usadas FROM public.meta_mensagem_custos
      WHERE instancia_id=v_msg.instancia_id AND mes_referencia=v_mes AND categoria='SERVICE'
        AND status IN ('confirmado','gratuito') AND mensagem_id <> v_msg.id;
      IF v_usadas < v_franquia THEN
        v_status := 'gratuito';
        v_valor_brl := 0;
        v_valor_usd := 0;
      END IF;
    END IF;
  ELSE
    v_status := 'estimado';
  END IF;

  INSERT INTO public.meta_mensagem_custos (
    mensagem_id, contato_id, instancia_id, user_id, telefone, wa_message_id,
    origem, categoria, pricing_type, status, entregue_em, valor_brl, valor_usd,
    fx_rate, mes_referencia, updated_at
  ) VALUES (
    v_msg.id, v_contato_id, v_msg.instancia_id, v_msg.user_id, v_msg.telefone, p_wa_message_id,
    v_origem, v_categoria, p_pricing_type, v_status,
    CASE WHEN p_status IN ('delivered','read') THEN v_evento_em ELSE NULL END,
    v_valor_brl, v_valor_usd, 5.50, v_mes, now()
  ) ON CONFLICT (mensagem_id) DO UPDATE SET
    contato_id=excluded.contato_id,
    origem=excluded.origem,
    categoria=excluded.categoria,
    pricing_type=coalesce(excluded.pricing_type, public.meta_mensagem_custos.pricing_type),
    status=CASE
      WHEN public.meta_mensagem_custos.status IN ('confirmado','gratuito') AND excluded.status='estimado' THEN public.meta_mensagem_custos.status
      ELSE excluded.status
    END,
    entregue_em=coalesce(public.meta_mensagem_custos.entregue_em, excluded.entregue_em),
    valor_brl=CASE
      WHEN public.meta_mensagem_custos.status IN ('confirmado','gratuito') AND excluded.status='estimado' THEN public.meta_mensagem_custos.valor_brl
      ELSE excluded.valor_brl
    END,
    valor_usd=CASE
      WHEN public.meta_mensagem_custos.status IN ('confirmado','gratuito') AND excluded.status='estimado' THEN public.meta_mensagem_custos.valor_usd
      ELSE excluded.valor_usd
    END,
    updated_at=now();
END;
$$;
REVOKE ALL ON FUNCTION public.registrar_custo_mensagem_meta(text,text,text,text,boolean,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_custo_mensagem_meta(text,text,text,text,boolean,timestamptz) TO service_role;