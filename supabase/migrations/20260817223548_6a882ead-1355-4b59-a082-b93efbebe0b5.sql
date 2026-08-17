CREATE TABLE IF NOT EXISTS public.acionamento_telefone_cpf (
  telefone_sufixo text PRIMARY KEY,
  cpf text NOT NULL,
  origem text NOT NULL DEFAULT 'mailing',
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.acionamento_telefone_cpf TO authenticated;
GRANT ALL ON public.acionamento_telefone_cpf TO service_role;

ALTER TABLE public.acionamento_telefone_cpf ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "atc_select_auth" ON public.acionamento_telefone_cpf;
CREATE POLICY "atc_select_auth" ON public.acionamento_telefone_cpf
FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "atc_admin_all" ON public.acionamento_telefone_cpf;
CREATE POLICY "atc_admin_all" ON public.acionamento_telefone_cpf
FOR ALL TO authenticated USING (public.is_admin_user(auth.uid())) WITH CHECK (public.is_admin_user(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_atc_cpf ON public.acionamento_telefone_cpf (cpf);

CREATE OR REPLACE FUNCTION public.acionamento_vincular_telefone_cpf(_pares jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_count integer;
BEGIN
  WITH src AS (
    SELECT public.phone_suffix8(x->>'telefone') AS suf,
           public.cpf_normalize(x->>'cpf') AS cpf_n,
           coalesce(x->>'origem','mailing') AS origem
    FROM jsonb_array_elements(coalesce(_pares,'[]'::jsonb)) x
  ), ok AS (
    SELECT DISTINCT ON (suf) suf, cpf_n, origem
    FROM src
    WHERE suf IS NOT NULL AND length(suf) = 8 AND length(cpf_n) = 11
    ORDER BY suf, cpf_n
  )
  INSERT INTO public.acionamento_telefone_cpf (telefone_sufixo, cpf, origem, atualizado_em)
  SELECT suf, cpf_n, origem, now() FROM ok
  ON CONFLICT (telefone_sufixo) DO UPDATE
    SET cpf = EXCLUDED.cpf, origem = EXCLUDED.origem, atualizado_em = now();
  SELECT count(*) INTO v_count FROM jsonb_array_elements(coalesce(_pares,'[]'::jsonb));
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.acionamento_vincular_telefone_cpf(jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.relatorio_ume_acionamentos(_data date)
 RETURNS TABLE(data_hora text, cpf text, origem text, acionamento text, ocorrencia text, telefone text, email text, agente text, assessoria text, ordem_ts timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH ini AS (
  SELECT (_data::text || ' 00:00:00')::timestamp AT TIME ZONE 'America/Sao_Paulo' AS t0,
         ((_data + 1)::text || ' 00:00:00')::timestamp AT TIME ZONE 'America/Sao_Paulo' AS t1
),
ume AS (
  SELECT DISTINCT public.cpf_normalize(d.cpf) AS cpf_n
  FROM public.devedores d
  WHERE d.credor LIKE 'ume_novo_mundo%' AND d.cpf IS NOT NULL
),
tel_cpf_raw AS (
  SELECT 1 AS prio, t.telefone_sufixo AS suf, public.cpf_normalize(t.cpf) AS cpf_n
  FROM public.acionamento_telefone_cpf t
  UNION ALL
  SELECT 2, public.phone_suffix8(d.telefone), public.cpf_normalize(d.cpf)
  FROM public.devedores d
  WHERE d.credor LIKE 'ume_novo_mundo%' AND d.telefone IS NOT NULL AND d.cpf IS NOT NULL
  UNION ALL
  SELECT 3, public.phone_suffix8(c.telefone), public.cpf_normalize(c.cpf)
  FROM public.meta_whatsapp_contatos c
  WHERE c.cpf IS NOT NULL AND c.telefone IS NOT NULL
  UNION ALL
  SELECT 4, public.phone_suffix8(t.numero), public.cpf_normalize(t.devedor_cpf)
  FROM public.devedor_telefones t
  WHERE t.numero IS NOT NULL AND t.devedor_cpf IS NOT NULL
),
tel_cpf AS (
  SELECT DISTINCT ON (suf) suf, cpf_n
  FROM tel_cpf_raw
  WHERE suf IS NOT NULL AND length(suf) = 8 AND length(cpf_n) = 11
  ORDER BY suf, prio, cpf_n
),
ume_tel AS (
  SELECT t.suf, t.cpf_n FROM tel_cpf t JOIN ume u ON u.cpf_n = t.cpf_n
),
envios_job AS (
  SELECT i.processado_em AS ts,
         CASE WHEN length(public.cpf_normalize(i.cpf)) = 11 THEN public.cpf_normalize(i.cpf) ELSE t.cpf_n END AS cpf_n,
         regexp_replace(coalesce(i.telefone,''), '\D', '', 'g') AS tel,
         coalesce(p.nome, 'AUTO') AS agente
  FROM public.envio_meta_job_item i
  JOIN public.envio_meta_job j ON j.id = i.job_id
  LEFT JOIN public.profiles p ON p.id = j.user_id
  LEFT JOIN tel_cpf t ON t.suf = public.phone_suffix8(i.telefone)
  CROSS JOIN ini
  WHERE i.status = 'enviado'
    AND i.processado_em >= ini.t0 AND i.processado_em < ini.t1
),
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
$function$;

CREATE OR REPLACE FUNCTION public.relatorio_ume_cobertura(_data date)
RETURNS TABLE(fonte text, total bigint, atribuidos bigint, sem_vinculo bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
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
tel_cpf_raw AS (
  SELECT 1 AS prio, t.telefone_sufixo AS suf, public.cpf_normalize(t.cpf) AS cpf_n FROM public.acionamento_telefone_cpf t
  UNION ALL
  SELECT 2, public.phone_suffix8(d.telefone), public.cpf_normalize(d.cpf) FROM public.devedores d
  WHERE d.credor LIKE 'ume_novo_mundo%' AND d.telefone IS NOT NULL AND d.cpf IS NOT NULL
  UNION ALL
  SELECT 3, public.phone_suffix8(c.telefone), public.cpf_normalize(c.cpf) FROM public.meta_whatsapp_contatos c
  WHERE c.cpf IS NOT NULL AND c.telefone IS NOT NULL
  UNION ALL
  SELECT 4, public.phone_suffix8(t.numero), public.cpf_normalize(t.devedor_cpf) FROM public.devedor_telefones t
  WHERE t.numero IS NOT NULL AND t.devedor_cpf IS NOT NULL
),
tel_cpf AS (
  SELECT DISTINCT ON (suf) suf, cpf_n FROM tel_cpf_raw
  WHERE suf IS NOT NULL AND length(suf) = 8 AND length(cpf_n) = 11
  ORDER BY suf, prio, cpf_n
),
ume_tel AS (SELECT t.suf FROM tel_cpf t JOIN ume u ON u.cpf_n = t.cpf_n),
lig AS (
  SELECT l.telefone_sufixo AS suf FROM public.tresc_ligacoes l WHERE l.data = _data AND l.call_date IS NOT NULL
),
env AS (
  SELECT public.phone_suffix8(i.telefone) AS suf
  FROM public.envio_meta_job_item i CROSS JOIN ini
  WHERE i.status = 'enviado' AND i.processado_em >= ini.t0 AND i.processado_em < ini.t1
),
inb AS (
  SELECT DISTINCT public.phone_suffix8(m.telefone) AS suf
  FROM public.meta_whatsapp_mensagens m CROSS JOIN ini
  WHERE m.direcao = 'entrada' AND m.timestamp_msg >= ini.t0 AND m.timestamp_msg < ini.t1 AND m.telefone IS NOT NULL
)
SELECT f.fonte, f.total, f.atribuidos, f.total - f.atribuidos
FROM (
  SELECT 'DISCADOR'::text AS fonte,
         (SELECT count(*) FROM lig) AS total,
         (SELECT count(*) FROM lig WHERE suf IN (SELECT suf FROM ume_tel)) AS atribuidos
  UNION ALL
  SELECT 'WHATSAPP_ENVIOS',
         (SELECT count(*) FROM env),
         (SELECT count(*) FROM env WHERE suf IN (SELECT suf FROM ume_tel))
  UNION ALL
  SELECT 'WHATSAPP_RESPOSTAS',
         (SELECT count(*) FROM inb),
         (SELECT count(*) FROM inb WHERE suf IN (SELECT suf FROM ume_tel))
) f
WHERE public.is_admin_user(auth.uid());
$$;

GRANT EXECUTE ON FUNCTION public.relatorio_ume_cobertura(date) TO authenticated, service_role;
