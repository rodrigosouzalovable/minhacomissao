CREATE TABLE public.video_contas_sociais (
  rede text PRIMARY KEY CHECK (rede IN ('tiktok','youtube','instagram')),
  handle text NOT NULL DEFAULT 'topviralfindsusa',
  perfil_url text,
  status text NOT NULL DEFAULT 'desconectado',
  nome_exibicao text,
  avatar_url text,
  pode_publicar boolean NOT NULL DEFAULT false,
  erro text,
  verificado_em timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_contas_sociais TO authenticated;
GRANT ALL ON public.video_contas_sociais TO service_role;
ALTER TABLE public.video_contas_sociais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin contas sociais" ON public.video_contas_sociais FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.video_contas_sociais (rede, perfil_url) VALUES
  ('tiktok','https://www.tiktok.com/@topviralfindsusa'),
  ('youtube','https://www.youtube.com/@topviralfindsusa'),
  ('instagram','https://www.instagram.com/topviralfindsusa');