CREATE INDEX IF NOT EXISTS idx_acordos_ativos_cpf_norm ON public.acordos (public.cpf_normalize(cliente_cpf)) WHERE status = 'ativo';
CREATE INDEX IF NOT EXISTS idx_acordos_ativos_tel_suf ON public.acordos (right(regexp_replace(coalesce(cliente_telefone,''),'[^0-9]','','g'),8)) WHERE status = 'ativo';

CREATE OR REPLACE FUNCTION public.acordos_ativos_por_destinatarios(_cpfs text[], _sufixos text[])
RETURNS TABLE(acordo_id uuid, cpf text, telefone text, cliente_nome text, empresa text, responsavel text, criado_em timestamptz, status text, sufixo text, cpf_norm text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id, a.cliente_cpf::text, a.cliente_telefone::text, a.cliente_nome::text, a.empresa::text,
         p.nome::text, a.criado_em::timestamptz, a.status::text,
         right(regexp_replace(coalesce(a.cliente_telefone,''),'[^0-9]','','g'),8),
         public.cpf_normalize(a.cliente_cpf)
  FROM public.acordos a
  LEFT JOIN public.profiles p ON p.id = a.user_id
  WHERE auth.uid() IS NOT NULL AND a.status = 'ativo'
    AND (public.cpf_normalize(a.cliente_cpf) = ANY(coalesce(_cpfs,'{}'))
      OR right(regexp_replace(coalesce(a.cliente_telefone,''),'[^0-9]','','g'),8) = ANY(coalesce(_sufixos,'{}')))
  LIMIT 20000
$$;
REVOKE ALL ON FUNCTION public.acordos_ativos_por_destinatarios(text[], text[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.acordos_ativos_por_destinatarios(text[], text[]) TO authenticated;