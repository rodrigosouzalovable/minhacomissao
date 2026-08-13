CREATE OR REPLACE FUNCTION public.relatorio_ume_acionamentos(_data date)
RETURNS TABLE (
  data_hora text,
  cpf text,
  origem text,
  acionamento text,
  ocorrencia text,
  telefone text,
  email text,
  agente text,
  assessoria text,
  ordem_ts timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH ini AS (
  SELECT (_data::text || ' 00:00:00')::timestamp AT TIME ZONE 'America/Sao_Paulo' AS t0,
         ((_data + 1)::text || ' 00:00:00')::timestamp AT TIME ZONE 'America/Sao_Paulo' AS t1
),
ume AS (
  SELECT DISTINCT public.cpf_normalize(d.cpf) AS cpf_n
  FROM public.devedores d
  WHERE d.credor LIKE 'ume_novo_mundo%' AND d.cpf IS NOT NULL
),
ume_tel AS (
  SELECT DISTINCT public.phone_suffix8(d.telefone) AS suf, public.cpf_normalize(d.cpf) AS cpf_n
  FROM public.devedores d
  WHERE d.credor LIKE 'ume_novo_mundo%' AND d.telefone IS NOT NULL AND d.cpf IS NOT NULL
),
-- 1) Envios WhatsApp de campanhas (Envio Meta)
envios_job AS (
  SELECT i.processado_em AS ts,
         public.cpf_normalize(i.cpf) AS cpf_n,
         regexp_replace(coalesce(i.telefone,''), '\D', '', 'g') AS tel,
         coalesce(p.nome, 'AUTO') AS agente
  FROM public.envio_meta_job_item i
  JOIN public.envio_meta_job j ON j.id = i.job_id
  LEFT JOIN public.profiles p ON p.id = j.user_id
  CROSS JOIN ini
  WHERE i.status = 'enviado'
    AND i.processado_em >= ini.t0 AND i.processado_em < ini.t1
    AND i.cpf IS NOT NULL
),
-- 2) Exportação de mailing (preparação da campanha)
mailing AS (
  SELECT i.created_at AS ts,
         public.cpf_normalize(i.cpf) AS cpf_n,
         regexp_replace(coalesce(i.telefone,''), '\D', '', 'g') AS tel,
         coalesce(p.nome, 'AUTO') AS agente
  FROM public.envio_meta_job_item i
  JOIN public.envio_meta_job j ON j.id = i.job_id
  LEFT JOIN public.profiles p ON p.id = j.user_id
  CROSS JOIN ini
  WHERE i.created_at >= ini.t0 AND i.created_at < ini.t1
    AND i.cpf IS NOT NULL
),
-- 3) Respostas do cliente no Inbox Meta (CPC) - uma por telefone/dia
inbound AS (
  SELECT DISTINCT ON (public.phone_suffix8(m.telefone))
         m.timestamp_msg AS ts,
         public.phone_suffix8(m.telefone) AS suf,
         regexp_replace(coalesce(m.telefone,''), '\D', '', 'g') AS tel
  FROM public.meta_whatsapp_mensagens m
  CROSS JOIN ini
  WHERE m.direcao = 'entrada'
    AND m.timestamp_msg >= ini.t0 AND m.timestamp_msg < ini.t1
    AND m.telefone IS NOT NULL
  ORDER BY public.phone_suffix8(m.telefone), m.timestamp_msg
),
-- 4) Ligações do discador 3C
ligacoes AS (
  SELECT l.call_date AS ts,
         l.telefone_sufixo AS suf,
         regexp_replace(coalesce(l.telefone,''), '\D', '', 'g') AS tel,
         coalesce(nullif(l.agente,''), 'AUTO') AS agente,
         l.atendida,
         coalesce(l.qualificacao_nome, l.status_texto, 'Discagem Ativa') AS qual
  FROM public.tresc_ligacoes l
  WHERE l.data = _data AND l.call_date IS NOT NULL
),
-- 5) Acordos lançados / quebras
acordos_dia AS (
  SELECT a.criado_em AS ts,
         public.cpf_normalize(a.cliente_cpf) AS cpf_n,
         regexp_replace(coalesce(a.cliente_telefone,''), '\D', '', 'g') AS tel,
         coalesce(p.nome, 'AUTO') AS agente,
         a.status
  FROM public.acordos a
  LEFT JOIN public.profiles p ON p.id = a.user_id
  CROSS JOIN ini
  WHERE a.criado_em >= ini.t0 AND a.criado_em < ini.t1
    AND a.cliente_cpf IS NOT NULL
),
-- 6) Parcelas pagas no dia
pagos AS (
  SELECT (pg.data_paga::text || ' 12:00:00')::timestamp AT TIME ZONE 'America/Sao_Paulo' AS ts,
         public.cpf_normalize(a.cliente_cpf) AS cpf_n,
         regexp_replace(coalesce(a.cliente_telefone,''), '\D', '', 'g') AS tel,
         coalesce(p.nome, 'AUTO') AS agente
  FROM public.pagamentos pg
  JOIN public.acordos a ON a.id = pg.acordo_id
  LEFT JOIN public.profiles p ON p.id = a.user_id
  WHERE pg.data_paga = _data AND a.cliente_cpf IS NOT NULL
),
eventos AS (
  SELECT e.ts, u.cpf_n, 'WHATSAPP'::text origem, 'ACAO'::text acionamento, 'Envio WhatsApp'::text ocorrencia, e.tel, e.agente
  FROM envios_job e JOIN ume u ON u.cpf_n = e.cpf_n
  UNION ALL
  SELECT e.ts, u.cpf_n, 'WHATSAPP', 'ACAO', 'Exportação Mailing', e.tel, e.agente
  FROM mailing e JOIN ume u ON u.cpf_n = e.cpf_n
  UNION ALL
  SELECT e.ts, t.cpf_n, 'WHATSAPP', 'CPC', 'Contato Com Cliente', e.tel, 'AUTO'
  FROM inbound e JOIN ume_tel t ON t.suf = e.suf
  UNION ALL
  SELECT e.ts, t.cpf_n, 'DISCADOR',
         CASE WHEN e.atendida THEN 'CPC' ELSE 'ACAO' END,
         CASE WHEN e.atendida THEN e.qual ELSE 'Discagem Ativa' END,
         e.tel, e.agente
  FROM ligacoes e JOIN ume_tel t ON t.suf = e.suf
  UNION ALL
  SELECT e.ts, u.cpf_n, 'WHATSAPP', 'CONVERSAO',
         CASE WHEN e.status = 'quebrado' THEN 'Quebra de Acordo' ELSE 'Acordo' END,
         e.tel, e.agente
  FROM acordos_dia e JOIN ume u ON u.cpf_n = e.cpf_n
  UNION ALL
  SELECT e.ts, u.cpf_n, 'WHATSAPP', 'CONVERSAO', 'Pagamento', e.tel, e.agente
  FROM pagos e JOIN ume u ON u.cpf_n = e.cpf_n
)
SELECT to_char(ev.ts AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI:SS'),
       lpad(ev.cpf_n, 11, '0'),
       ev.origem,
       ev.acionamento,
       ev.ocorrencia,
       nullif(regexp_replace(ev.tel, '^55(?=\d{10,11}$)', ''), ''),
       NULL::text,
       ev.agente,
       'SOUZA E RIBEIRO'::text,
       ev.ts
FROM eventos ev
WHERE public.is_admin_user(auth.uid())
ORDER BY ev.ts;
$$;

REVOKE ALL ON FUNCTION public.relatorio_ume_acionamentos(date) FROM public;
GRANT EXECUTE ON FUNCTION public.relatorio_ume_acionamentos(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.relatorio_ume_acionamentos(date) TO service_role;