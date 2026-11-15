CREATE TABLE public.video_roteiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tema text NOT NULL,
  nicho text NOT NULL DEFAULT 'GTA 6',
  gancho text,
  roteiro text,
  cenas jsonb NOT NULL DEFAULT '[]'::jsonb,
  cta text,
  legenda text,
  hashtags text,
  modelo_video text NOT NULL DEFAULT 'seedance-2.5',
  duracao_seg integer NOT NULL DEFAULT 30,
  produto_id uuid,
  status text NOT NULL DEFAULT 'rascunho',
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.video_afiliado_produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  plataforma text NOT NULL DEFAULT 'amazon',
  link text NOT NULL,
  preco numeric,
  comissao_pct numeric,
  slug text UNIQUE,
  cliques integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.video_postagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roteiro_id uuid REFERENCES public.video_roteiros(id) ON DELETE CASCADE,
  rede text NOT NULL,
  agendado_para timestamptz,
  status text NOT NULL DEFAULT 'pendente',
  url_publicada text,
  erro text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_roteiros, public.video_afiliado_produtos, public.video_postagens TO authenticated;
GRANT ALL ON public.video_roteiros, public.video_afiliado_produtos, public.video_postagens TO service_role;
ALTER TABLE public.video_roteiros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_afiliado_produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_postagens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin roteiros" ON public.video_roteiros FOR ALL TO authenticated USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "admin produtos" ON public.video_afiliado_produtos FOR ALL TO authenticated USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "admin postagens" ON public.video_postagens FOR ALL TO authenticated USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));