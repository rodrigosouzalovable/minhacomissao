ALTER TABLE public.ume_carteira_clientes ADD COLUMN IF NOT EXISTS primeiro_lote date;

CREATE OR REPLACE FUNCTION public.ume_carteira_gravar(p_carteira text, p_lote date, p_clientes jsonb, p_parcelas jsonb)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' SET statement_timeout TO '120s'
AS $function$
DECLARE v_n integer := 0;
BEGIN
  IF NOT public.sftp_ume_pode() THEN RAISE EXCEPTION 'Apenas administradores.' USING ERRCODE = '42501'; END IF;
  -- primeiro_lote guarda o dia em que o CPF apareceu pela primeira vez (clientes novos).
  INSERT INTO ume_carteira_clientes(cpf, borrower_id, nome, carteira, data_lote, atualizado_em, primeiro_lote)
  SELECT public.cpf_normalize(c->>'cpf'), c->>'borrower_id', c->>'nome', p_carteira, p_lote, now(), p_lote
  FROM jsonb_array_elements(coalesce(p_clientes, '[]'::jsonb)) c
  WHERE coalesce(c->>'cpf','') <> '' AND coalesce(c->>'borrower_id','') <> ''
  ON CONFLICT (cpf) DO UPDATE SET borrower_id = EXCLUDED.borrower_id, nome = EXCLUDED.nome,
    carteira = EXCLUDED.carteira, data_lote = EXCLUDED.data_lote, atualizado_em = now()
  WHERE ume_carteira_clientes.data_lote <= EXCLUDED.data_lote;

  INSERT INTO ume_carteira_parcelas(installment_id, cpf, borrower_id, contrato, vencimento, valor, carteira, data_lote)
  SELECT p->>'installment_id', public.cpf_normalize(p->>'cpf'), p->>'borrower_id', p->>'contrato',
    (p->>'vencimento')::date, (p->>'valor')::numeric, p_carteira, p_lote
  FROM jsonb_array_elements(coalesce(p_parcelas, '[]'::jsonb)) p
  WHERE coalesce(p->>'installment_id','') <> ''
  ON CONFLICT (installment_id) DO UPDATE SET cpf = EXCLUDED.cpf, borrower_id = EXCLUDED.borrower_id,
    contrato = EXCLUDED.contrato, vencimento = EXCLUDED.vencimento, valor = EXCLUDED.valor,
    carteira = EXCLUDED.carteira, data_lote = EXCLUDED.data_lote
  WHERE ume_carteira_parcelas.data_lote <= EXCLUDED.data_lote;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END $function$;

-- Candidatos da campanha diária da carteira SFTP (UME 201845262, Odres 217490215).
-- Exclui acordo ativo, supressão/blacklist e quem já recebeu campanha do dono nos últimos p_dias_fadiga dias.
CREATE OR REPLACE FUNCTION public.carteira_sftp_candidatos(p_dias_fadiga integer, p_limite_ume integer, p_limite_odres integer)
 RETURNS TABLE(cpf text, nome text, telefone text, credor text, avista numeric, atraso integer, novo boolean, score integer)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' SET statement_timeout TO '120s'
AS $function$
WITH recentes AS (
  SELECT DISTINCT right(regexp_replace(coalesce(i.telefone,''), '\D', '', 'g'), 8) AS suf
  FROM envio_meta_job j JOIN envio_meta_job_item i ON i.job_id = j.id
  WHERE j.user_id = 'ee649720-b8ce-47a2-859e-100a3a9ae6bb'::uuid
    AND j.created_at >= now() - make_interval(days => greatest(1, p_dias_fadiga))
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
    AND NOT EXISTS (SELECT 1 FROM recentes r WHERE r.suf = right(c.telefone, 8))
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
rk AS (SELECT u.*, row_number() OVER (PARTITION BY u.credor ORDER BY u.score DESC, u.avista DESC, u.cpf) AS rn FROM uni u)
SELECT rk.cpf, rk.nome, rk.telefone, rk.credor, round(rk.avista, 2), rk.atraso, rk.novo, rk.score
FROM rk
WHERE (rk.credor = 'ume' AND rk.rn <= greatest(0, p_limite_ume))
   OR (rk.credor = 'odres_cred' AND rk.rn <= greatest(0, p_limite_odres))
ORDER BY rk.rn, rk.credor;
$function$;
REVOKE ALL ON FUNCTION public.carteira_sftp_candidatos(integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.carteira_sftp_candidatos(integer, integer, integer) TO service_role;