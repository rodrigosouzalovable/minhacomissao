ALTER TABLE public.consulta_cpf_notificacoes
  ADD COLUMN IF NOT EXISTS telefones_suffix text[] NOT NULL DEFAULT '{}'::text[];

CREATE INDEX IF NOT EXISTS idx_consulta_cpf_notif_suffix
  ON public.consulta_cpf_notificacoes USING GIN (telefones_suffix);

CREATE INDEX IF NOT EXISTS idx_consulta_cpf_notif_created
  ON public.consulta_cpf_notificacoes (created_at DESC);

CREATE OR REPLACE FUNCTION public.atendente_por_telefone_consulta(p_suffix text, p_dias integer DEFAULT 7)
RETURNS TABLE(user_id uuid, nome text, cpf text, consultado_em timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT n.assigned_user_id, p.nome, n.cpf, n.created_at
  FROM public.consulta_cpf_notificacoes n
  JOIN public.profiles p ON p.id = n.assigned_user_id
  WHERE n.created_at >= now() - (COALESCE(p_dias, 7) || ' days')::interval
    AND (
      p_suffix = ANY(n.telefones_suffix)
      OR EXISTS (
        SELECT 1 FROM public.devedor_telefones dt
        WHERE public.cpf_normalize(dt.devedor_cpf) = public.cpf_normalize(n.cpf)
          AND dt.ativo IS TRUE
          AND public.phone_suffix8(dt.numero) = p_suffix
      )
    )
  ORDER BY n.created_at DESC
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.atendente_por_telefone_consulta(text, integer) TO authenticated, service_role;