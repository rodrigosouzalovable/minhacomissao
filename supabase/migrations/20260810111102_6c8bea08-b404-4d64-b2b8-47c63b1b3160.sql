CREATE TABLE public.meta_qualificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cor text NOT NULL DEFAULT '#3b82f6',
  ordem int NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_qualificacoes TO authenticated;
GRANT ALL ON public.meta_qualificacoes TO service_role;
ALTER TABLE public.meta_qualificacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qualif_select_auth" ON public.meta_qualificacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "qualif_admin_all" ON public.meta_qualificacoes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_meta_qualificacoes_touch BEFORE UPDATE ON public.meta_qualificacoes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.meta_contato_qualificacao (
  contato_id uuid PRIMARY KEY REFERENCES public.meta_whatsapp_contatos(id) ON DELETE CASCADE,
  qualificacao_id uuid NOT NULL REFERENCES public.meta_qualificacoes(id) ON DELETE CASCADE,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_meta_contato_qualif_created ON public.meta_contato_qualificacao (created_at DESC);
CREATE INDEX idx_meta_contato_qualif_qid ON public.meta_contato_qualificacao (qualificacao_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_contato_qualificacao TO authenticated;
GRANT ALL ON public.meta_contato_qualificacao TO service_role;
ALTER TABLE public.meta_contato_qualificacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cq_select_auth" ON public.meta_contato_qualificacao FOR SELECT TO authenticated USING (true);
CREATE POLICY "cq_insert_auth" ON public.meta_contato_qualificacao FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "cq_update_auth" ON public.meta_contato_qualificacao FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "cq_delete_auth" ON public.meta_contato_qualificacao FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE TRIGGER trg_meta_contato_qualif_touch BEFORE UPDATE ON public.meta_contato_qualificacao
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.meta_qualificacao_caixa (
  folder_id uuid PRIMARY KEY,
  ativo boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_qualificacao_caixa TO authenticated;
GRANT ALL ON public.meta_qualificacao_caixa TO service_role;
ALTER TABLE public.meta_qualificacao_caixa ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qcx_select_auth" ON public.meta_qualificacao_caixa FOR SELECT TO authenticated USING (true);
CREATE POLICY "qcx_admin_all" ON public.meta_qualificacao_caixa FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.meta_qualificacoes (nome, cor, ordem) VALUES
  ('Interessado', '#16a34a', 1),
  ('Sem interesse', '#dc2626', 2),
  ('Já pagou', '#0ea5e9', 3),
  ('Aguardando boleto', '#f59e0b', 4),
  ('Sem contato', '#6b7280', 5);