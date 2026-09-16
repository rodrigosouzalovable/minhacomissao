CREATE OR REPLACE FUNCTION public.gm_leads_interessados_admin()
RETURNS TABLE (
  atribuicao_id uuid,
  lead_id uuid,
  busca_id uuid,
  colaborador_id uuid,
  colaborador_nome text,
  marcado_em timestamptz,
  nome text,
  telefone text,
  telefone_internacional text,
  endereco text,
  categoria text,
  site text,
  avaliacao numeric,
  total_avaliacoes integer,
  tem_whatsapp boolean,
  whatsapp_verificado_em timestamptz,
  place_id text,
  instagram_url text,
  instagram_username text,
  instagram_seguidores integer,
  instagram_site text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id,
         l.id,
         l.busca_id,
         a.colaborador_id,
         COALESCE(p.nome, p.email, 'Colaborador'),
         COALESCE(a.atualizado_em, a.contatado_em),
         l.nome,
         l.telefone,
         l.telefone_internacional,
         l.endereco,
         l.categoria,
         l.site,
         l.avaliacao,
         l.total_avaliacoes,
         l.tem_whatsapp,
         l.whatsapp_verificado_em,
         l.place_id,
         l.instagram_url,
         l.instagram_username,
         l.instagram_seguidores,
         l.instagram_site
  FROM public.google_maps_lead_atribuicoes a
  JOIN public.google_maps_leads l ON l.id = a.lead_id
  LEFT JOIN public.profiles p ON p.id = a.colaborador_id
  WHERE a.resultado = 'interessado'
    AND public.has_role(auth.uid(), 'admin')
  ORDER BY COALESCE(a.atualizado_em, a.contatado_em) DESC;
$$;

REVOKE ALL ON FUNCTION public.gm_leads_interessados_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gm_leads_interessados_admin() TO authenticated;