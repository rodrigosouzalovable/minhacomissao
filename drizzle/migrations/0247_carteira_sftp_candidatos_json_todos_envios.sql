CREATE OR REPLACE FUNCTION public.carteira_sftp_candidatos_json(
  p_dias_ume integer, p_dias_odres integer, p_limite_ume integer, p_limite_odres integer)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '120s'
AS $function$
WITH janela AS (SELECT now() - make_interval(days => greatest(1, p_dias_ume, p_dias_odres)) AS desde),
recentes AS (
  SELECT x.suf, max(x.ts) AS ult FROM (
    -- Campanhas do dono (inclui pendentes ainda não enviados)
    SELECT right(regexp_replace(coalesce(i.telefone,''), '\D', '', 'g'), 8) AS suf, j.created_at AS ts
    FROM envio_meta_job j JOIN envio_meta_job_item i ON i.job_id = j.id, janela
    WHERE j.user_id = 'ee649720-b8ce-47a2-859e-100a3a9ae6bb'::uuid AND j.created_at >= janela.desde
    UNION ALL
    -- Envios confirmados de qualquer campanha (mesma regra da antirrepetição do disparo)
    SELECT right(regexp_replace(coalesce(i.telefone,''), '\D', '', 'g'), 8), i.processado_em
    FROM envio_meta_job_item i, janela
    WHERE i.status = 'enviado' AND i.processado_em >= janela.desde
  ) x GROUP BY 1
),
ativos AS (SELECT DISTINCT public.cpf_normalize(a.cliente_cpf) AS cpf FROM acordos a WHERE a.status = 'ativo'),
par AS (SELECT p.cpf, sum(p.valor) AS avista, min(p.vencimento) AS venc FROM ume_carteira_parcelas p GROUP BY p.cpf),
base AS (
  SELECT c.cpf, c.nome, c.telefone,
    CASE c.carteira WHEN '201845262' THEN 'ume' ELSE 'odres_cred' END AS credor,
    par.avista, (current_date - par.venc)::int AS atraso,
    coalesce(c.primeiro_lote >= current_date - 7, false) AS novo
  FROM ume_carteira_clientes c JOIN par ON par.cpf = c.cpf
  WHERE c.carteira IN ('201845262', '217490215')
    AND c.telefone ~ '^55[1-9][0-9]9[0-9]{8}$' AND par.avista > 0
    AND NOT EXISTS (SELECT 1 FROM ativos a WHERE a.cpf = c.cpf)
    AND NOT EXISTS (
      SELECT 1 FROM recentes r WHERE r.suf = right(c.telefone, 8)
        AND r.ult >= now() - make_interval(days => greatest(1,
          CASE WHEN c.carteira = '201845262' THEN p_dias_ume ELSE p_dias_odres END)))
    AND NOT EXISTS (SELECT 1 FROM meta_destinatario_supressao s WHERE s.telefone_sufixo = right(c.telefone, 8))
),
sc AS (
  SELECT b.*, (CASE WHEN b.novo THEN 100 ELSE 0 END
    + CASE WHEN b.atraso BETWEEN 1 AND 30 THEN 40 WHEN b.atraso BETWEEN 31 AND 90 THEN 35
           WHEN b.atraso BETWEEN 91 AND 180 THEN 25 WHEN b.atraso BETWEEN 181 AND 360 THEN 15
           WHEN b.atraso > 360 THEN 5 ELSE 10 END
    + CASE WHEN b.avista BETWEEN 100 AND 1500 THEN 20 WHEN b.avista > 1500 AND b.avista <= 3000 THEN 10 ELSE 5 END)::int AS score
  FROM base b
),
uni AS (SELECT DISTINCT ON (right(sc.telefone, 8)) sc.* FROM sc ORDER BY right(sc.telefone, 8), sc.score DESC, sc.avista DESC),
rk AS (SELECT u.*, row_number() OVER (PARTITION BY u.credor ORDER BY u.score DESC, u.avista DESC, u.cpf) AS rn FROM uni u),
sel AS (
  SELECT rk.cpf, rk.nome, rk.telefone, rk.credor, round(rk.avista, 2) AS avista, rk.atraso, rk.novo, rk.score, rk.rn
  FROM rk
  WHERE (rk.credor = 'ume' AND rk.rn <= greatest(0, p_limite_ume))
     OR (rk.credor = 'odres_cred' AND rk.rn <= greatest(0, p_limite_odres))
)
SELECT coalesce(jsonb_agg(to_jsonb(sel) - 'rn' ORDER BY sel.rn, sel.credor), '[]'::jsonb) FROM sel;
$function$;

REVOKE ALL ON FUNCTION public.carteira_sftp_candidatos_json(integer, integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.carteira_sftp_candidatos_json(integer, integer, integer, integer) TO service_role;