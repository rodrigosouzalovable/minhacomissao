CREATE TABLE public.objecao_catalogo (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  objecao_chave text NOT NULL,
  resposta text NOT NULL,
  origem text NOT NULL DEFAULT 'ia',
  credor text,
  usos integer NOT NULL DEFAULT 0,
  conversoes integer NOT NULL DEFAULT 0,
  score numeric NOT NULL DEFAULT 0,
  fixada boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.objecao_catalogo TO authenticated;
GRANT ALL ON public.objecao_catalogo TO service_role;

ALTER TABLE public.objecao_catalogo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "objecao_catalogo_select" ON public.objecao_catalogo
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "objecao_catalogo_admin_write" ON public.objecao_catalogo
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_objecao_catalogo_chave ON public.objecao_catalogo (objecao_chave, ativo, score DESC);

CREATE TABLE public.objecao_sugestoes_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instancia_id uuid NOT NULL,
  telefone text NOT NULL,
  mensagem_id text NOT NULL,
  objecao_chave text NOT NULL,
  sugestoes jsonb NOT NULL DEFAULT '[]'::jsonb,
  catalogo_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  usada_idx integer,
  usuario_id uuid,
  resultado text NOT NULL DEFAULT 'pendente',
  criado_em timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.objecao_sugestoes_log TO authenticated;
GRANT ALL ON public.objecao_sugestoes_log TO service_role;

ALTER TABLE public.objecao_sugestoes_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "objecao_log_select" ON public.objecao_sugestoes_log
  FOR SELECT TO authenticated USING (public.pode_ver_instancia_meta(auth.uid(), instancia_id));
CREATE POLICY "objecao_log_insert" ON public.objecao_sugestoes_log
  FOR INSERT TO authenticated WITH CHECK (public.pode_ver_instancia_meta(auth.uid(), instancia_id));
CREATE POLICY "objecao_log_update" ON public.objecao_sugestoes_log
  FOR UPDATE TO authenticated USING (public.pode_ver_instancia_meta(auth.uid(), instancia_id));

CREATE UNIQUE INDEX idx_objecao_log_msg ON public.objecao_sugestoes_log (instancia_id, telefone, mensagem_id);
CREATE INDEX idx_objecao_log_pendente ON public.objecao_sugestoes_log (resultado, criado_em);

CREATE TRIGGER trg_objecao_catalogo_updated BEFORE UPDATE ON public.objecao_catalogo
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_objecao_log_updated BEFORE UPDATE ON public.objecao_sugestoes_log
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();