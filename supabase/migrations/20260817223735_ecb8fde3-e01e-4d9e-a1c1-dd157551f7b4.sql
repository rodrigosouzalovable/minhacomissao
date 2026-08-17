CREATE OR REPLACE FUNCTION public.relatorio_ume_sem_vinculo(_data date)
RETURNS TABLE(fonte text, telefone text, quantidade bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
WITH ini AS (
  SELECT (_data::text || ' 00:00:00')::timestamp AT TIME ZONE 'America/Sao_Paulo' AS t0,
         ((_data + 1)::text || ' 00:00:00')::timestamp AT TIME ZONE 'America/Sao_Paulo' AS t1
),
vinculados AS (
  SELECT telefone_sufixo AS suf FROM public.acionamento_telefone_cpf
  UNION
  SELECT public.phone_suffix8(c.telefone) FROM public.meta_whatsapp_contatos c WHERE c.cpf IS NOT NULL AND c.telefone IS NOT NULL
  UNION
  SELECT public.phone_suffix8(t.numero) FROM public.devedor_telefones t WHERE t.numero IS NOT NULL AND t.devedor_cpf IS NOT NULL
),
lig AS (
  SELECT 'DISCADOR'::text fonte, l.telefone_sufixo suf, regexp_replace(coalesce(l.telefone,''), '\D', '', 'g') tel
  FROM public.tresc_ligacoes l WHERE l.data = _data AND l.call_date IS NOT NULL
  UNION ALL
  SELECT 'WHATSAPP_ENVIOS', public.phone_suffix8(i.telefone), regexp_replace(coalesce(i.telefone,''), '\D', '', 'g')
  FROM public.envio_meta_job_item i CROSS JOIN ini
  WHERE i.status = 'enviado' AND i.processado_em >= ini.t0 AND i.processado_em < ini.t1
  UNION ALL
  SELECT 'WHATSAPP_RESPOSTAS', public.phone_suffix8(m.telefone), regexp_replace(coalesce(m.telefone,''), '\D', '', 'g')
  FROM public.meta_whatsapp_mensagens m CROSS JOIN ini
  WHERE m.direcao = 'entrada' AND m.timestamp_msg >= ini.t0 AND m.timestamp_msg < ini.t1 AND m.telefone IS NOT NULL
)
SELECT l.fonte, min(l.tel), count(*)
FROM lig l
WHERE public.is_admin_user(auth.uid())
  AND l.suf IS NOT NULL
  AND l.suf NOT IN (SELECT suf FROM vinculados WHERE suf IS NOT NULL)
GROUP BY l.fonte, l.suf
ORDER BY 1, 3 DESC;
$$;

GRANT EXECUTE ON FUNCTION public.relatorio_ume_sem_vinculo(date) TO authenticated, service_role;