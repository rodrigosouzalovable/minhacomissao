-- Config
CREATE TABLE public.tresc_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_url text NOT NULL DEFAULT 'https://app.3c.fluxoti.com.br/api/v1',
  campanhas jsonb NOT NULL DEFAULT '[]'::jsonb,
  ativo boolean NOT NULL DEFAULT true,
  ultimo_sync timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tresc_config TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.tresc_config TO authenticated;
GRANT ALL ON public.tresc_config TO service_role;
ALTER TABLE public.tresc_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tresc_config_select" ON public.tresc_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "tresc_config_admin_write" ON public.tresc_config FOR ALL TO authenticated
  USING (public.is_admin_user(auth.uid())) WITH CHECK (public.is_admin_user(auth.uid()));

-- Qualificacoes
CREATE TABLE public.tresc_qualificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qualificacao_id integer NOT NULL UNIQUE,
  nome text NOT NULL,
  cor text,
  classificacao text NOT NULL DEFAULT 'ignorar' CHECK (classificacao IN ('ignorar','cpc','cpca')),
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tresc_qualificacoes TO authenticated;
GRANT ALL ON public.tresc_qualificacoes TO service_role;
ALTER TABLE public.tresc_qualificacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tresc_qual_select" ON public.tresc_qualificacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "tresc_qual_admin_write" ON public.tresc_qualificacoes FOR ALL TO authenticated
  USING (public.is_admin_user(auth.uid())) WITH CHECK (public.is_admin_user(auth.uid()));

-- Cache de ligacoes
CREATE TABLE public.tresc_ligacoes (
  call_id text PRIMARY KEY,
  data date NOT NULL,
  hora text NOT NULL,
  telefone text,
  telefone_sufixo text,
  status_id integer,
  status_texto text,
  atendida boolean NOT NULL DEFAULT false,
  qualificacao_id integer,
  qualificacao_nome text,
  agente text,
  campanha text,
  campanha_id integer,
  modo text,
  call_date timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tresc_ligacoes_data_hora ON public.tresc_ligacoes (data, hora);
CREATE INDEX idx_tresc_ligacoes_suf_data ON public.tresc_ligacoes (telefone_sufixo, data);
GRANT SELECT ON public.tresc_ligacoes TO authenticated;
GRANT ALL ON public.tresc_ligacoes TO service_role;
ALTER TABLE public.tresc_ligacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tresc_lig_select" ON public.tresc_ligacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "tresc_lig_admin_write" ON public.tresc_ligacoes FOR ALL TO authenticated
  USING (public.is_admin_user(auth.uid())) WITH CHECK (public.is_admin_user(auth.uid()));

-- Colunas automaticas no relatorio por hora
ALTER TABLE public.relatorio_acionamentos
  ADD COLUMN IF NOT EXISTS ligacoes_auto integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS alo_auto integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS alo_manual boolean NOT NULL DEFAULT false;

-- Triggers de updated_at
CREATE TRIGGER tg_tresc_config_touch BEFORE UPDATE ON public.tresc_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tg_tresc_qual_touch BEFORE UPDATE ON public.tresc_qualificacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Limpeza de cache
CREATE OR REPLACE FUNCTION public.tresc_limpar_cache_antigo()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_del integer;
BEGIN
  DELETE FROM public.tresc_ligacoes WHERE data < (CURRENT_DATE - INTERVAL '90 days');
  GET DIAGNOSTICS v_del = ROW_COUNT;
  RETURN v_del;
END; $$;