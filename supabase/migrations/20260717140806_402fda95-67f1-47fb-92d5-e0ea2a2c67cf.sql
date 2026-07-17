
-- ============ CONFIG ============
CREATE TABLE public.meta_lembrete_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ativo boolean NOT NULL DEFAULT false,
  instancia_ids uuid[] NOT NULL DEFAULT '{}',
  template_id_d3 uuid REFERENCES public.meta_whatsapp_templates(id) ON DELETE SET NULL,
  template_id_d0 uuid REFERENCES public.meta_whatsapp_templates(id) ON DELETE SET NULL,
  variaveis_map_d3 jsonb NOT NULL DEFAULT '{}',
  variaveis_map_d0 jsonb NOT NULL DEFAULT '{}',
  min_seg integer NOT NULL DEFAULT 30,
  max_seg integer NOT NULL DEFAULT 60,
  hora_inicio text NOT NULL DEFAULT '08:30',
  notificar_telefones text[] NOT NULL DEFAULT ARRAY['62991672674','62994300880'],
  ultima_execucao timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_lembrete_config TO authenticated;
GRANT ALL ON public.meta_lembrete_config TO service_role;
ALTER TABLE public.meta_lembrete_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam config lembrete meta"
ON public.meta_lembrete_config
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ LOG ============
CREATE TABLE public.meta_lembrete_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pagamento_id uuid NOT NULL,
  acordo_id uuid,
  user_id uuid,
  tipo text NOT NULL CHECK (tipo IN ('D-3','D0')),
  data_ref date NOT NULL,
  instancia_id uuid,
  instancia_nome text,
  telefone text,
  sucesso boolean NOT NULL DEFAULT false,
  erro text,
  wa_message_id text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pagamento_id, tipo, data_ref)
);

CREATE INDEX idx_meta_lembrete_log_data_ref ON public.meta_lembrete_log (data_ref DESC, tipo);
CREATE INDEX idx_meta_lembrete_log_criado_em ON public.meta_lembrete_log (criado_em DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_lembrete_log TO authenticated;
GRANT ALL ON public.meta_lembrete_log TO service_role;
ALTER TABLE public.meta_lembrete_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins veem log lembrete meta"
ON public.meta_lembrete_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger atualizado_em
CREATE OR REPLACE FUNCTION public.tg_meta_lembrete_config_touch()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.atualizado_em = now(); RETURN NEW; END; $$;

CREATE TRIGGER meta_lembrete_config_touch
BEFORE UPDATE ON public.meta_lembrete_config
FOR EACH ROW EXECUTE FUNCTION public.tg_meta_lembrete_config_touch();

-- Habilita extensões (idempotente)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
