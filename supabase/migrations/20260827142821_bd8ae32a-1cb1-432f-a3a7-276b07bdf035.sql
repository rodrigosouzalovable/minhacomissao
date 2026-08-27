ALTER TABLE public.meta_whatsapp_instances
  ADD COLUMN IF NOT EXISTS recuperacao_ativa boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recuperacao_desde timestamptz,
  ADD COLUMN IF NOT EXISTS recuperacao_msgs_meta_dia integer,
  ADD COLUMN IF NOT EXISTS dias_green_consecutivos integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recuperacao_ultimo_envio_em timestamptz,
  ADD COLUMN IF NOT EXISTS recuperacao_proximo_envio_em timestamptz;

ALTER TABLE public.meta_envio_pool_config
  ADD COLUMN IF NOT EXISTS recuperacao_auto boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS recuperacao_msgs_min_dia integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS recuperacao_msgs_max_dia integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS recuperacao_intervalo_min_seg integer NOT NULL DEFAULT 1200,
  ADD COLUMN IF NOT EXISTS recuperacao_intervalo_max_seg integer NOT NULL DEFAULT 2400,
  ADD COLUMN IF NOT EXISTS recuperacao_msgs_dia_piora integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS recuperacao_max_por_destino_dia integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS preventivo_msgs_dia integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS recuperacao_dias_green_alta integer NOT NULL DEFAULT 3;

CREATE TABLE IF NOT EXISTS public.meta_recuperacao_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instancia_id uuid NOT NULL REFERENCES public.meta_whatsapp_instances(id) ON DELETE CASCADE,
  destino_instancia_id uuid REFERENCES public.meta_whatsapp_instances(id) ON DELETE SET NULL,
  destino_telefone text,
  tipo text NOT NULL DEFAULT 'recuperacao',
  status text NOT NULL DEFAULT 'enviado',
  erro text,
  wamid text,
  enviado_em timestamptz NOT NULL DEFAULT now(),
  resposta_em timestamptz,
  dia date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.meta_recuperacao_log TO authenticated;
GRANT ALL ON public.meta_recuperacao_log TO service_role;
ALTER TABLE public.meta_recuperacao_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meta_recuperacao_log_select" ON public.meta_recuperacao_log
  FOR SELECT TO authenticated
  USING (public.is_admin_user(auth.uid()) OR public.pode_ver_instancia_meta(auth.uid(), instancia_id));

CREATE INDEX IF NOT EXISTS idx_meta_recuperacao_log_inst_dia ON public.meta_recuperacao_log (instancia_id, dia);
CREATE INDEX IF NOT EXISTS idx_meta_recuperacao_log_destino_dia ON public.meta_recuperacao_log (destino_instancia_id, dia);
CREATE INDEX IF NOT EXISTS idx_meta_instances_recuperacao ON public.meta_whatsapp_instances (recuperacao_ativa) WHERE recuperacao_ativa;