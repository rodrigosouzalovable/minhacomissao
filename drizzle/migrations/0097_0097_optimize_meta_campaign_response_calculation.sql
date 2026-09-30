CREATE INDEX IF NOT EXISTS idx_meta_msgs_entrada_suffix_ts
  ON public.meta_whatsapp_mensagens (public.phone_suffix8(telefone), timestamp_msg)
  WHERE direcao = 'entrada';

CREATE INDEX IF NOT EXISTS idx_acordos_phone_suffix8_criado
  ON public.acordos (public.phone_suffix8(cliente_telefone), criado_em);

CREATE INDEX IF NOT EXISTS idx_acordos_cpf_normalize_criado
  ON public.acordos (public.cpf_normalize(cliente_cpf), criado_em);

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
    FROM public.envio_meta_job_item
   WHERE job_id = _job_id;

  WITH it AS MATERIALIZED (
    SELECT public.phone_suffix8(telefone) AS suf,
           min(processado_em) AS enviado_em,
           max(nullif(public.cpf_normalize(cpf), '')) AS cpf
      FROM public.envio_meta_job_item
     WHERE job_id = _job_id
       AND status = 'enviado'
       AND processado_em IS NOT NULL
       AND public.phone_suffix8(telefone) IS NOT NULL
     GROUP BY public.phone_suffix8(telefone)
  ), bounds AS MATERIALIZED (
    SELECT min(enviado_em) AS inicio,
           max(enviado_em) AS fim
      FROM it
  ), resp AS MATERIALIZED (
    SELECT it.suf, count(m.id) AS qtd
      FROM it
      JOIN bounds b ON b.inicio IS NOT NULL
      JOIN public.meta_whatsapp_mensagens m
        ON public.phone_suffix8(m.telefone) = it.suf
       AND m.direcao = 'entrada'
       AND m.timestamp_msg > it.enviado_em
       AND m.timestamp_msg < it.enviado_em + interval '72 hours'
       AND m.timestamp_msg > b.inicio
       AND m.timestamp_msg < b.fim + interval '72 hours'
     GROUP BY it.suf
  ), acc_phone AS MATERIALIZED (
    SELECT a.id, a.valor_total
      FROM it
      JOIN bounds b ON b.inicio IS NOT NULL
      JOIN public.acordos a
        ON public.phone_suffix8(a.cliente_telefone) = it.suf
       AND a.criado_em > it.enviado_em
       AND a.criado_em < it.enviado_em + interval '15 days'
       AND a.criado_em > b.inicio
       AND a.criado_em < b.fim + interval '15 days'
  ), acc_cpf AS MATERIALIZED (
    SELECT a.id, a.valor_total
      FROM it
      JOIN bounds b ON b.inicio IS NOT NULL
      JOIN public.acordos a
        ON it.cpf IS NOT NULL
       AND public.cpf_normalize(a.cliente_cpf) = it.cpf
       AND a.criado_em > it.enviado_em
       AND a.criado_em < it.enviado_em + interval '15 days'
       AND a.criado_em > b.inicio
       AND a.criado_em < b.fim + interval '15 days'
  ), acc AS (
    SELECT id, valor_total FROM acc_phone
    UNION
    SELECT id, valor_total FROM acc_cpf
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

REVOKE ALL ON FUNCTION public.envio_meta_job_resultado_calcular(uuid) FROM public;
REVOKE ALL ON FUNCTION public.envio_meta_job_resultado_calcular(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.envio_meta_job_resultado_calcular(uuid) TO authenticated, service_role;