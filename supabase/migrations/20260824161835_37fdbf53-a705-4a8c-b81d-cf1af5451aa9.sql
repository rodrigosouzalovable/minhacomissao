-- =========================
-- PONTO / ATIVIDADE
-- =========================

CREATE TYPE public.ponto_tipo AS ENUM ('entrada','saida_almoco','volta_almoco','saida');
CREATE TYPE public.ponto_ajuste_status AS ENUM ('pendente','aprovado','recusado');
CREATE TYPE public.presenca_status AS ENUM ('ativo','inativo','almoco','offline');

-- 1) Registros de ponto
CREATE TABLE public.ponto_registros (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  tipo public.ponto_tipo NOT NULL,
  registrado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip TEXT,
  user_agent TEXT,
  device_id TEXT,
  origem TEXT NOT NULL DEFAULT 'auto',
  ajustado_por UUID REFERENCES auth.users(id),
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, data, tipo)
);
CREATE INDEX idx_ponto_registros_user_data ON public.ponto_registros(user_id, data DESC);
CREATE INDEX idx_ponto_registros_data ON public.ponto_registros(data DESC);

GRANT SELECT ON public.ponto_registros TO authenticated;
GRANT ALL ON public.ponto_registros TO service_role;
ALTER TABLE public.ponto_registros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuario ve seu proprio ponto"
ON public.ponto_registros FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admin ve todo o ponto"
ON public.ponto_registros FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin gerencia ponto"
ON public.ponto_registros FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2) IPs autorizados
CREATE TABLE public.ponto_ips_autorizados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cidr TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ponto_ips_autorizados TO authenticated;
GRANT ALL ON public.ponto_ips_autorizados TO service_role;
ALTER TABLE public.ponto_ips_autorizados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin gerencia ips ponto"
ON public.ponto_ips_autorizados FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3) Jornada
CREATE TABLE public.ponto_jornada_config (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  entrada_prevista TIME NOT NULL DEFAULT '08:00',
  saida_prevista TIME NOT NULL DEFAULT '18:00',
  minutos_almoco INTEGER NOT NULL DEFAULT 60,
  tolerancia_min INTEGER NOT NULL DEFAULT 10,
  dias_semana INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5,6],
  ponto_obrigatorio BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ponto_jornada_config TO authenticated;
GRANT ALL ON public.ponto_jornada_config TO service_role;
ALTER TABLE public.ponto_jornada_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuario ve sua jornada"
ON public.ponto_jornada_config FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admin gerencia jornadas"
ON public.ponto_jornada_config FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4) Presenca
CREATE TABLE public.atividade_presenca (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ultima_interacao TIMESTAMPTZ NOT NULL DEFAULT now(),
  status public.presenca_status NOT NULL DEFAULT 'ativo',
  pagina TEXT,
  inativo_desde TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.atividade_presenca TO authenticated;
GRANT ALL ON public.atividade_presenca TO service_role;
ALTER TABLE public.atividade_presenca ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuario ve sua presenca"
ON public.atividade_presenca FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admin ve presenca de todos"
ON public.atividade_presenca FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 5) Inatividade
CREATE TABLE public.atividade_inatividade (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  inicio TIMESTAMPTZ NOT NULL,
  fim TIMESTAMPTZ,
  duracao_seg INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_atividade_inatividade_user_data ON public.atividade_inatividade(user_id, data DESC);
CREATE UNIQUE INDEX idx_atividade_inatividade_aberta ON public.atividade_inatividade(user_id) WHERE fim IS NULL;

GRANT SELECT ON public.atividade_inatividade TO authenticated;
GRANT ALL ON public.atividade_inatividade TO service_role;
ALTER TABLE public.atividade_inatividade ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuario ve sua inatividade"
ON public.atividade_inatividade FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admin ve inatividade de todos"
ON public.atividade_inatividade FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 6) Ajustes
CREATE TABLE public.ponto_ajuste_solicitacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  tipo public.ponto_tipo NOT NULL,
  horario_solicitado TIMESTAMPTZ NOT NULL,
  motivo TEXT NOT NULL,
  status public.ponto_ajuste_status NOT NULL DEFAULT 'pendente',
  aprovado_por UUID REFERENCES auth.users(id),
  respondido_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ponto_ajuste_user ON public.ponto_ajuste_solicitacoes(user_id, data DESC);

GRANT SELECT, INSERT ON public.ponto_ajuste_solicitacoes TO authenticated;
GRANT ALL ON public.ponto_ajuste_solicitacoes TO service_role;
ALTER TABLE public.ponto_ajuste_solicitacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuario ve seus ajustes"
ON public.ponto_ajuste_solicitacoes FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Usuario cria seus ajustes"
ON public.ponto_ajuste_solicitacoes FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND status = 'pendente');

CREATE POLICY "Admin gerencia ajustes"
ON public.ponto_ajuste_solicitacoes FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Triggers updated_at
CREATE TRIGGER trg_ponto_registros_updated BEFORE UPDATE ON public.ponto_registros
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ponto_ips_updated BEFORE UPDATE ON public.ponto_ips_autorizados
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ponto_jornada_updated BEFORE UPDATE ON public.ponto_jornada_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ponto_ajuste_updated BEFORE UPDATE ON public.ponto_ajuste_solicitacoes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Presenca agregada para admin (nome do funcionario + status calculado)
CREATE OR REPLACE FUNCTION public.presenca_ao_vivo()
RETURNS TABLE (
  user_id UUID,
  nome TEXT,
  status TEXT,
  ultima_interacao TIMESTAMPTZ,
  inativo_seg INTEGER,
  pagina TEXT,
  ultimo_ponto public.ponto_tipo,
  ultimo_ponto_em TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.nome,
    CASE
      WHEN ap.user_id IS NULL OR ap.ultima_interacao < now() - interval '5 minutes' THEN 'offline'
      WHEN lp.tipo = 'saida_almoco' THEN 'almoco'
      WHEN ap.ultima_interacao < now() - interval '10 minutes' THEN 'inativo'
      ELSE 'ativo'
    END::text,
    ap.ultima_interacao,
    GREATEST(0, EXTRACT(EPOCH FROM (now() - COALESCE(ap.ultima_interacao, now())))::int),
    ap.pagina,
    lp.tipo,
    lp.registrado_em
  FROM public.profiles p
  LEFT JOIN public.atividade_presenca ap ON ap.user_id = p.id
  LEFT JOIN LATERAL (
    SELECT pr.tipo, pr.registrado_em
    FROM public.ponto_registros pr
    WHERE pr.user_id = p.id
    ORDER BY pr.registrado_em DESC
    LIMIT 1
  ) lp ON true
  WHERE public.has_role(auth.uid(), 'admin')
    AND COALESCE(p.ativo, true) = true
  ORDER BY p.nome;
$$;

REVOKE ALL ON FUNCTION public.presenca_ao_vivo() FROM public;
GRANT EXECUTE ON FUNCTION public.presenca_ao_vivo() TO authenticated;