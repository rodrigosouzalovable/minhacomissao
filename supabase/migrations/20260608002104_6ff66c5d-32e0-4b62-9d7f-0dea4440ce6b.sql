CREATE TABLE public.solicitacoes_planilha (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  faixas_atraso text[] NOT NULL DEFAULT '{}',
  credores text[] NOT NULL DEFAULT '{}',
  qtd_clientes int,
  observacao text,
  status text NOT NULL DEFAULT 'pendente',
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.solicitacoes_planilha TO authenticated;
GRANT ALL ON public.solicitacoes_planilha TO service_role;
ALTER TABLE public.solicitacoes_planilha ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own requests"
  ON public.solicitacoes_planilha FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Users create own requests"
  ON public.solicitacoes_planilha FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins update status"
  ON public.solicitacoes_planilha FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_solicitacoes_planilha_updated
  BEFORE UPDATE ON public.solicitacoes_planilha
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();