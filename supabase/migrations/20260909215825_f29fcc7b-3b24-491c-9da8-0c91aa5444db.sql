CREATE OR REPLACE FUNCTION public.envio_meta_job_resultado_calcular(_job_id uuid)
RETURNS public.envio_meta_job_resultado
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.envio_meta_job_resultado;
  v_enviados int := 0;
  v_falhas int := 0;
  v_respostas int := 0;
  v_contatos int := 0;
  v_acordos int := 0;
  v_valor numeric := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'apenas administradores';
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

CREATE INDEX IF NOT EXISTS idx_acordos_tel_suffix_criado
  ON public.acordos (right(regexp_replace(coalesce(cliente_telefone,''), '\D', '', 'g'), 8), criado_em);