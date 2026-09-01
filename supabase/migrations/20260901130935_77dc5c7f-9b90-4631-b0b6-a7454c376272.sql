CREATE TABLE public.ume_lotes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_arquivo text NOT NULL DEFAULT '',
  total integer NOT NULL DEFAULT 0,
  processados integer NOT NULL DEFAULT 0,
  encontrados integer NOT NULL DEFAULT 0,
  nao_localizados integer NOT NULL DEFAULT 0,
  erros integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pendente',
  erro text,
  forcar boolean NOT NULL DEFAULT false,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ume_lotes TO authenticated;
GRANT ALL ON public.ume_lotes TO service_role;

ALTER TABLE public.ume_lotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ume_lotes_admin_all" ON public.ume_lotes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "ume_lotes_own_select" ON public.ume_lotes FOR SELECT TO authenticated
  USING (criado_por = auth.uid());
CREATE POLICY "ume_lotes_own_insert" ON public.ume_lotes FOR INSERT TO authenticated
  WITH CHECK (criado_por = auth.uid());
CREATE POLICY "ume_lotes_own_delete" ON public.ume_lotes FOR DELETE TO authenticated
  USING (criado_por = auth.uid());

CREATE TABLE public.ume_lote_itens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lote_id uuid NOT NULL REFERENCES public.ume_lotes(id) ON DELETE CASCADE,
  cpf text NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  valor_sem_juros numeric,
  valor_com_juros numeric,
  nome text,
  telefone text,
  dias_atraso integer,
  fase text,
  limite_total numeric,
  tentativas integer NOT NULL DEFAULT 0,
  erro text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ume_lote_itens TO authenticated;
GRANT ALL ON public.ume_lote_itens TO service_role;

ALTER TABLE public.ume_lote_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ume_lote_itens_admin_all" ON public.ume_lote_itens FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "ume_lote_itens_own_select" ON public.ume_lote_itens FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ume_lotes l WHERE l.id = lote_id AND l.criado_por = auth.uid()));
CREATE POLICY "ume_lote_itens_own_insert" ON public.ume_lote_itens FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.ume_lotes l WHERE l.id = lote_id AND l.criado_por = auth.uid()));

CREATE INDEX idx_ume_lote_itens_lote_status ON public.ume_lote_itens (lote_id, status);
CREATE INDEX idx_ume_lotes_criado_por ON public.ume_lotes (criado_por, created_at DESC);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_ume_lotes_updated_at BEFORE UPDATE ON public.ume_lotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ume_lote_itens_updated_at BEFORE UPDATE ON public.ume_lote_itens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();