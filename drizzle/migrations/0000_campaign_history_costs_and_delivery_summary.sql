ALTER TABLE public.envio_meta_job
  ADD COLUMN IF NOT EXISTS custo_total_contatos integer,
  ADD COLUMN IF NOT EXISTS custo_cobrados integer,
  ADD COLUMN IF NOT EXISTS custo_gratis integer,
  ADD COLUMN IF NOT EXISTS custo_categoria text,
  ADD COLUMN IF NOT EXISTS custo_preco_usd numeric,
  ADD COLUMN IF NOT EXISTS custo_usd numeric,
  ADD COLUMN IF NOT EXISTS custo_brl numeric,
  ADD COLUMN IF NOT EXISTS custo_fx_rate numeric;

CREATE INDEX IF NOT EXISTS envio_meta_job_user_created_idx
  ON public.envio_meta_job (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS envio_meta_job_user_folder_created_idx
  ON public.envio_meta_job (user_id, folder_id, created_at DESC);
CREATE INDEX IF NOT EXISTS envio_meta_job_instancia_ids_gin_idx
  ON public.envio_meta_job USING gin (instancia_ids);

CREATE OR REPLACE FUNCTION public.envio_meta_jobs_delivery_resumo(_job_ids uuid[])
RETURNS TABLE(job_id uuid, aceito bigint, entregue bigint, lida bigint, falhou bigint, aguardando bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH jobs AS (
    SELECT j.id, j.user_id, j.iniciado_em
    FROM public.envio_meta_job j
    WHERE j.id = ANY(coalesce(_job_ids, ARRAY[]::uuid[]))
      AND j.user_id = auth.uid()
  ), itens AS (
    SELECT i.id, i.job_id, i.telefone, i.wa_message_id, j.user_id, j.iniciado_em
    FROM public.envio_meta_job_item i
    JOIN jobs j ON j.id = i.job_id
    WHERE i.status = 'enviado'
  ), best AS (
    SELECT i.job_id, i.id,
      coalesce(max(CASE lower(coalesce(l.status, ''))
        WHEN 'read' THEN 3 WHEN 'delivered' THEN 2 WHEN 'failed' THEN 4
        WHEN 'sent' THEN 1 WHEN 'replied' THEN 1 ELSE 0 END), 0) AS rank
    FROM itens i
    LEFT JOIN public.meta_whatsapp_envios_log l ON (
      (i.wa_message_id IS NOT NULL AND l.wa_message_id = i.wa_message_id)
      OR (i.wa_message_id IS NULL AND l.telefone = i.telefone AND l.user_id = i.user_id
        AND l.enviado_em >= coalesce(i.iniciado_em, now() - interval '7 days'))
    )
    GROUP BY i.job_id, i.id
  )
  SELECT j.id,
    count(*) FILTER (WHERE b.rank = 1),
    count(*) FILTER (WHERE b.rank = 2),
    count(*) FILTER (WHERE b.rank = 3),
    count(*) FILTER (WHERE b.rank = 4),
    count(*) FILTER (WHERE b.rank = 0)
  FROM jobs j
  LEFT JOIN best b ON b.job_id = j.id
  GROUP BY j.id;
$$;

REVOKE ALL ON FUNCTION public.envio_meta_jobs_delivery_resumo(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.envio_meta_jobs_delivery_resumo(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.envio_meta_jobs_delivery_resumo(uuid[]) TO service_role;