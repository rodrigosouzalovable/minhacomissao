
-- configuracoes_motivacao (singleton)
CREATE TABLE public.configuracoes_motivacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mural_top3_visivel boolean NOT NULL DEFAULT true,
  frase_custom text,
  frase_data date,
  frase_autor text,
  atualizado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.configuracoes_motivacao TO authenticated;
GRANT UPDATE, INSERT ON public.configuracoes_motivacao TO authenticated;
GRANT ALL ON public.configuracoes_motivacao TO service_role;

ALTER TABLE public.configuracoes_motivacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos autenticados leem configuracoes_motivacao"
  ON public.configuracoes_motivacao FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins inserem configuracoes_motivacao"
  ON public.configuracoes_motivacao FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins atualizam configuracoes_motivacao"
  ON public.configuracoes_motivacao FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_configuracoes_motivacao_updated
  BEFORE UPDATE ON public.configuracoes_motivacao
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- linha singleton inicial
INSERT INTO public.configuracoes_motivacao (mural_top3_visivel) VALUES (true);

-- premios_semanais
CREATE TABLE public.premios_semanais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mes_ano text NOT NULL,
  semana int NOT NULL CHECK (semana BETWEEN 1 AND 4),
  valor numeric NOT NULL DEFAULT 50,
  atingido_em timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pendente',
  pago_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, mes_ano, semana)
);

GRANT SELECT, INSERT, UPDATE ON public.premios_semanais TO authenticated;
GRANT ALL ON public.premios_semanais TO service_role;

ALTER TABLE public.premios_semanais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário vê seus próprios prêmios e admin vê todos"
  ON public.premios_semanais FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Usuário insere seus próprios prêmios"
  ON public.premios_semanais FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin atualiza prêmios"
  ON public.premios_semanais FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_premios_semanais_updated
  BEFORE UPDATE ON public.premios_semanais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
