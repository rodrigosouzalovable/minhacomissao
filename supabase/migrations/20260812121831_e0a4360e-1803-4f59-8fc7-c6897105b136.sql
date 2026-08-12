CREATE OR REPLACE FUNCTION public.envio_meta_job_resumo(_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _job public.envio_meta_job%ROWTYPE;
  _result jsonb;
BEGIN
  SELECT * INTO _job FROM public.envio_meta_job WHERE id = _job_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF auth.role() <> 'service_role'
     AND _job.user_id <> auth.uid()
     AND NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT jsonb_build_object(
    'status', COALESCE((
      SELECT jsonb_object_agg(s.status, s.qtd)
      FROM (
        SELECT i.status, count(*)::integer AS qtd
        FROM public.envio_meta_job_item i
        WHERE i.job_id = _job_id
        GROUP BY i.status
      ) s
    ), '{}'::jsonb),
    'instancias', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'instancia_nome', x.instancia_nome,
        'enviados', x.enviados,
        'erros', x.erros
      ) ORDER BY x.enviados DESC, x.instancia_nome)
      FROM (
        SELECT COALESCE(i.instancia_nome, 'Não atribuída') AS instancia_nome,
               count(*) FILTER (WHERE i.status = 'enviado')::integer AS enviados,
               count(*) FILTER (WHERE i.status = 'erro')::integer AS erros
        FROM public.envio_meta_job_item i
        WHERE i.job_id = _job_id
          AND i.status IN ('enviado', 'erro')
        GROUP BY COALESCE(i.instancia_nome, 'Não atribuída')
      ) x
    ), '[]'::jsonb),
    'ultimos_erros', COALESCE((
      SELECT jsonb_agg(to_jsonb(e) ORDER BY e.processado_em DESC)
      FROM (
        SELECT i.telefone, i.instancia_nome, i.erro, i.processado_em
        FROM public.envio_meta_job_item i
        WHERE i.job_id = _job_id AND i.status = 'erro'
        ORDER BY i.processado_em DESC NULLS LAST
        LIMIT 50
      ) e
    ), '[]'::jsonb)
  ) INTO _result;

  RETURN _result;
END;
$$;

REVOKE ALL ON FUNCTION public.envio_meta_job_resumo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.envio_meta_job_resumo(uuid) TO authenticated, service_role;