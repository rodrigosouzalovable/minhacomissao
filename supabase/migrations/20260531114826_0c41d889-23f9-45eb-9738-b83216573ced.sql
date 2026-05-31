
-- 1) Adicionar data_admissao em profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS data_admissao DATE;

-- 2) Tabela de metas mensais (NN / Colchão / Global)
CREATE TABLE IF NOT EXISTS public.comite_metas_novomundo (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mes_ano TEXT NOT NULL,
  tipo TEXT NOT NULL,
  faixa TEXT NOT NULL,
  meta_valor NUMERIC NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_por UUID,
  UNIQUE (mes_ano, tipo, faixa)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comite_metas_novomundo TO authenticated;
GRANT ALL ON public.comite_metas_novomundo TO service_role;

ALTER TABLE public.comite_metas_novomundo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comite_metas_select_auth"
  ON public.comite_metas_novomundo FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "comite_metas_write_admin_gestor"
  ON public.comite_metas_novomundo FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

CREATE TRIGGER trg_comite_metas_updated_at
  BEFORE UPDATE ON public.comite_metas_novomundo
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Tabela de textos editáveis por mês
CREATE TABLE IF NOT EXISTS public.comite_textos_novomundo (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mes_ano TEXT NOT NULL,
  bloco TEXT NOT NULL,
  conteudo TEXT NOT NULL DEFAULT '',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_por UUID,
  UNIQUE (mes_ano, bloco)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comite_textos_novomundo TO authenticated;
GRANT ALL ON public.comite_textos_novomundo TO service_role;

ALTER TABLE public.comite_textos_novomundo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comite_textos_select_auth"
  ON public.comite_textos_novomundo FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "comite_textos_write_admin_gestor"
  ON public.comite_textos_novomundo FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

CREATE TRIGGER trg_comite_textos_updated_at
  BEFORE UPDATE ON public.comite_textos_novomundo
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
