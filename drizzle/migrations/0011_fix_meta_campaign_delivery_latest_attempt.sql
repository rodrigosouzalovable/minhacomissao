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
    SELECT id, wa_message_id
    FROM public.envio_meta_job_item
    WHERE job_id = _job_id AND status = 'enviado'
  ), estado_atual AS (
    SELECT i.id,
      CASE lower(coalesce(l.status, ''))
        WHEN 'read' THEN 3
        WHEN 'delivered' THEN 2
        WHEN 'failed' THEN 4
        WHEN 'sent' THEN 1
        WHEN 'replied' THEN 1
        ELSE 0
      END AS rank
    FROM itens i
    LEFT JOIN LATERAL (
      SELECT log.status
      FROM public.meta_whatsapp_envios_log log
      WHERE i.wa_message_id IS NOT NULL
        AND log.wa_message_id = i.wa_message_id
      ORDER BY log.enviado_em DESC, log.id DESC
      LIMIT 1
    ) l ON true
  )
  SELECT jsonb_build_object(
    'aceito', count(*) FILTER (WHERE rank = 1),
    'entregue', count(*) FILTER (WHERE rank = 2),
    'lida', count(*) FILTER (WHERE rank = 3),
    'falhou', count(*) FILTER (WHERE rank = 4),
    'aguardando', count(*) FILTER (WHERE rank = 0)
  ) INTO _res
  FROM estado_atual;

  RETURN coalesce(_res, jsonb_build_object('aceito',0,'entregue',0,'lida',0,'falhou',0,'aguardando',0));
END;
$$;

GRANT EXECUTE ON FUNCTION public.envio_meta_job_delivery_resumo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.envio_meta_job_delivery_resumo(uuid) TO service_role;