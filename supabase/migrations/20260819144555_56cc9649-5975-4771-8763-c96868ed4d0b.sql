-- Controles anti-queda de qualidade Meta

ALTER TABLE public.meta_envio_pool_config
  ADD COLUMN IF NOT EXISTS cota_max_hora integer NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS pct_max_cota_meta numeric NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS resposta_min_pct numeric NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS nao_lidas_max_pct numeric NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS quarentena_dias integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS escada_retorno jsonb NOT NULL DEFAULT '[20,40,80]'::jsonb,
  ADD COLUMN IF NOT EXISTS freio_ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS supressao_ativa boolean NOT NULL DEFAULT true;

UPDATE public.meta_envio_pool_config
SET cota_fase1 = 15,
    cota_fase2 = 40,
    cota_fase3 = 80,
    cota_fase4 = 200,
    horario_inicio = '09:00:00',
    horario_fim = '19:00:00'
WHERE id = 1;

ALTER TABLE public.meta_whatsapp_instances
  ADD COLUMN IF NOT EXISTS quarentena_ate timestamptz,
  ADD COLUMN IF NOT EXISTS quarentena_motivo text,
  ADD COLUMN IF NOT EXISTS teto_escada integer;

CREATE TABLE IF NOT EXISTS public.meta_instance_freio_diario (
  instancia_id uuid NOT NULL REFERENCES public.meta_whatsapp_instances(id) ON DELETE CASCADE,
  dia date NOT NULL DEFAULT CURRENT_DATE,
  teto_efetivo integer NOT NULL DEFAULT 0,
  enviados integer NOT NULL DEFAULT 0,
  resposta_pct numeric,
  nao_lidas_pct numeric,
  motivo_reducao text,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  tenant_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  PRIMARY KEY (instancia_id, dia)
);

GRANT SELECT ON public.meta_instance_freio_diario TO authenticated;
GRANT ALL ON public.meta_instance_freio_diario TO service_role;
ALTER TABLE public.meta_instance_freio_diario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "freio_diario_select" ON public.meta_instance_freio_diario;
CREATE POLICY "freio_diario_select" ON public.meta_instance_freio_diario
  FOR SELECT TO authenticated
  USING (public.pode_ver_instancia_meta(auth.uid(), instancia_id));

CREATE TABLE IF NOT EXISTS public.meta_destinatario_supressao (
  telefone_sufixo text PRIMARY KEY,
  telefone text NOT NULL,
  motivo text NOT NULL,
  falhas integer NOT NULL DEFAULT 1,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  tenant_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_destinatario_supressao TO authenticated;
GRANT ALL ON public.meta_destinatario_supressao TO service_role;
ALTER TABLE public.meta_destinatario_supressao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "supressao_admin_all" ON public.meta_destinatario_supressao;
CREATE POLICY "supressao_admin_all" ON public.meta_destinatario_supressao
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_meta_mensagens_inst_criado
  ON public.meta_whatsapp_mensagens (instancia_id, criado_em DESC);