DROP POLICY IF EXISTS tenant_scope_all ON public.envio_meta_job;
DROP POLICY IF EXISTS tenant_scope_all ON public.envio_meta_job_item;

DROP POLICY IF EXISTS "admins veem resultados de campanha" ON public.envio_meta_job_resultado;
CREATE POLICY "campaign owners view own results"
ON public.envio_meta_job_resultado
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.envio_meta_job j
    WHERE j.id = envio_meta_job_resultado.job_id
      AND j.user_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.envio_meta_job_delivery_resumo(_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _job public.envio_meta_job;
  _res jsonb;
BEGIN
  SELECT * INTO _job FROM public.envio_meta_job WHERE id = _job_id;
  IF _job.id IS NULL THEN
    RETURN jsonb_build_object('aceito',0,'entregue',0,'lida',0,'falhou',0,'aguardando',0);
  END IF;

  IF auth.role() <> 'service_role' AND _job.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'nao autorizado';
  END IF;

  WITH itens AS (
    SELECT id, telefone, wa_message_id
    FROM public.envio_meta_job_item
    WHERE job_id = _job_id AND status = 'enviado'
  ),
  best AS (
    SELECT i.id,
      coalesce(max(
        CASE lower(coalesce(l.status, ''))
          WHEN 'read' THEN 3
          WHEN 'delivered' THEN 2
          WHEN 'failed' THEN 4
          WHEN 'sent' THEN 1
          WHEN 'replied' THEN 1
          ELSE 0
        END
      ), 0) AS rank
    FROM itens i
    LEFT JOIN public.meta_whatsapp_envios_log l
      ON (
        (i.wa_message_id IS NOT NULL AND l.wa_message_id = i.wa_message_id)
        OR (
          i.wa_message_id IS NULL
          AND l.telefone = i.telefone
          AND l.user_id = _job.user_id
          AND l.enviado_em >= coalesce(_job.iniciado_em, now() - interval '7 days')
        )
      )
    GROUP BY i.id
  )
  SELECT jsonb_build_object(
    'aceito', count(*) FILTER (WHERE rank = 1),
    'entregue', count(*) FILTER (WHERE rank = 2),
    'lida', count(*) FILTER (WHERE rank = 3),
    'falhou', count(*) FILTER (WHERE rank = 4),
    'aguardando', count(*) FILTER (WHERE rank = 0)
  ) INTO _res
  FROM best;

  RETURN coalesce(_res, jsonb_build_object('aceito',0,'entregue',0,'lida',0,'falhou',0,'aguardando',0));
END;
$$;

CREATE OR REPLACE FUNCTION public.envio_meta_job_resultado_calcular(_job_id uuid)
RETURNS public.envio_meta_job_resultado
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.envio_meta_job_resultado;
  v_job_user_id uuid;
  v_enviados int := 0;
  v_falhas int := 0;
  v_respostas int := 0;
  v_contatos int := 0;
  v_acordos int := 0;
  v_valor numeric := 0;
BEGIN
  SELECT user_id INTO v_job_user_id
  FROM public.envio_meta_job
  WHERE id = _job_id;

  IF v_job_user_id IS NULL THEN
    RAISE EXCEPTION 'campanha nao encontrada';
  END IF;

  IF auth.role() <> 'service_role' AND v_job_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'nao autorizado';
  END IF;

  SELECT count(*) FILTER (WHERE status = 'enviado'),
         count(*) FILTER (WHERE status IN ('erro','falha','sem_whatsapp'))
    INTO v_enviados, v_falhas
    FROM public.envio_meta_job_item WHERE job_id = _job_id;

  WITH it AS (
    SELECT right(regexp_replace(telefone, '\D', '', 'g'), 8) AS suf,
           min(processado_em) AS enviado_em,
           max(nullif(regexp_replace(coalesce(cpf,''), '\D', '', 'g'), '')) AS cpf
      FROM public.envio_meta_job_item
     WHERE job_id = _job_id AND status = 'enviado' AND processado_em IS NOT NULL
     GROUP BY 1
  ), resp AS (
    SELECT it.suf, count(m.id) AS qtd
      FROM it
      JOIN public.meta_whatsapp_mensagens m
        ON right(regexp_replace(m.telefone, '\D', '', 'g'), 8) = it.suf
       AND m.direcao = 'entrada'
       AND m.timestamp_msg > it.enviado_em
       AND m.timestamp_msg < it.enviado_em + interval '72 hours'
     GROUP BY it.suf
  ), acc AS (
    SELECT DISTINCT a.id, a.valor_total
      FROM it
      JOIN public.acordos a
        ON (
             right(regexp_replace(coalesce(a.cliente_telefone,''), '\D', '', 'g'), 8) = it.suf
             OR (it.cpf IS NOT NULL
                 AND regexp_replace(coalesce(a.cliente_cpf,''), '\D', '', 'g') = it.cpf)
           )
       AND a.criado_em > it.enviado_em
       AND a.criado_em < it.enviado_em + interval '15 days'
  )
  SELECT coalesce((SELECT sum(qtd) FROM resp), 0),
         coalesce((SELECT count(*) FROM resp), 0),
         coalesce((SELECT count(*) FROM acc), 0),
         coalesce((SELECT sum(valor_total) FROM acc), 0)
    INTO v_respostas, v_contatos, v_acordos, v_valor;

  INSERT INTO public.envio_meta_job_resultado AS t (
    job_id, enviados, falhas, respostas, conversas_abertas, contatos_responderam,
    acordos_fechados, acordos_valor, taxa_resposta, taxa_acordo, calculado_em
  ) VALUES (
    _job_id, v_enviados, v_falhas, v_respostas, v_contatos, v_contatos,
    v_acordos, v_valor,
    CASE WHEN v_enviados > 0 THEN round((v_contatos::numeric / v_enviados) * 100, 2) ELSE 0 END,
    CASE WHEN v_enviados > 0 THEN round((v_acordos::numeric / v_enviados) * 100, 2) ELSE 0 END,
    now()
  )
  ON CONFLICT (job_id) DO UPDATE SET
    enviados = excluded.enviados,
    falhas = excluded.falhas,
    respostas = excluded.respostas,
    conversas_abertas = excluded.conversas_abertas,
    contatos_responderam = excluded.contatos_responderam,
    acordos_fechados = excluded.acordos_fechados,
    acordos_valor = excluded.acordos_valor,
    taxa_resposta = excluded.taxa_resposta,
    taxa_acordo = excluded.taxa_acordo,
    calculado_em = now()
  RETURNING * INTO r;

  RETURN r;
END;
$$;