
-- Cabeçalho da campanha
CREATE TABLE public.meta_campanha_agendada (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  nome text NOT NULL,
  template_id uuid NOT NULL,
  template_nome text NOT NULL,
  instancia_ids uuid[] NOT NULL,
  template_id_by_instance jsonb NOT NULL DEFAULT '{}'::jsonb,
  min_seg int NOT NULL DEFAULT 40,
  max_seg int NOT NULL DEFAULT 90,
  folga_cota numeric NOT NULL DEFAULT 0.80,
  status text NOT NULL DEFAULT 'agendada',
  total_itens int NOT NULL DEFAULT 0,
  enviados int NOT NULL DEFAULT 0,
  erros int NOT NULL DEFAULT 0,
  data_inicio date,
  data_fim_prevista date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_campanha_agendada TO authenticated;
GRANT ALL ON public.meta_campanha_agendada TO service_role;
ALTER TABLE public.meta_campanha_agendada ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own campanhas"
  ON public.meta_campanha_agendada FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_campanha_status ON public.meta_campanha_agendada(status, data_inicio);
CREATE INDEX idx_campanha_user ON public.meta_campanha_agendada(user_id);

-- Itens (um por cliente)
CREATE TABLE public.meta_campanha_item (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campanha_id uuid NOT NULL REFERENCES public.meta_campanha_agendada(id) ON DELETE CASCADE,
  cliente jsonb NOT NULL,
  instancia_id uuid NOT NULL,
  data_prevista date NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  enviado_em timestamptz,
  erro text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_campanha_item TO authenticated;
GRANT ALL ON public.meta_campanha_item TO service_role;
ALTER TABLE public.meta_campanha_item ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own campanha items"
  ON public.meta_campanha_item FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.meta_campanha_agendada c
      WHERE c.id = meta_campanha_item.campanha_id
        AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.meta_campanha_agendada c
      WHERE c.id = meta_campanha_item.campanha_id
        AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

CREATE INDEX idx_item_campanha_data ON public.meta_campanha_item(campanha_id, data_prevista, status);
CREATE INDEX idx_item_data_status ON public.meta_campanha_item(data_prevista, status);
CREATE INDEX idx_item_instancia_data ON public.meta_campanha_item(instancia_id, data_prevista);

-- Trigger updated_at
CREATE TRIGGER update_meta_campanha_agendada_updated_at
  BEFORE UPDATE ON public.meta_campanha_agendada
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
