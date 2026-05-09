
ALTER TABLE public.whatsapp_aquecimento_status_log
  ADD COLUMN IF NOT EXISTS whatsapp_msg_id text;

CREATE INDEX IF NOT EXISTS idx_status_log_msg_id
  ON public.whatsapp_aquecimento_status_log(whatsapp_msg_id)
  WHERE whatsapp_msg_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.whatsapp_aquecimento_status_emojis_pool (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  emoji text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_aquecimento_status_emojis_pool ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam emojis pool"
  ON public.whatsapp_aquecimento_status_emojis_pool
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Autenticados leem emojis pool"
  ON public.whatsapp_aquecimento_status_emojis_pool
  FOR SELECT TO authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS public.whatsapp_aquecimento_status_respostas_pool (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  texto text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_aquecimento_status_respostas_pool ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam respostas pool"
  ON public.whatsapp_aquecimento_status_respostas_pool
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Autenticados leem respostas pool"
  ON public.whatsapp_aquecimento_status_respostas_pool
  FOR SELECT TO authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS public.whatsapp_aquecimento_status_interacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status_log_id uuid NOT NULL REFERENCES public.whatsapp_aquecimento_status_log(id) ON DELETE CASCADE,
  instancia_id uuid NOT NULL REFERENCES public.user_whatsapp_instances(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('visualizado','reacao','resposta')),
  conteudo text,
  agendado_para timestamptz NOT NULL DEFAULT now(),
  executado_em timestamptz,
  sucesso boolean,
  erro text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (status_log_id, instancia_id, tipo)
);

CREATE INDEX IF NOT EXISTS idx_status_interacoes_pendentes
  ON public.whatsapp_aquecimento_status_interacoes(agendado_para)
  WHERE executado_em IS NULL;

CREATE INDEX IF NOT EXISTS idx_status_interacoes_instancia_dia
  ON public.whatsapp_aquecimento_status_interacoes(instancia_id, executado_em);

ALTER TABLE public.whatsapp_aquecimento_status_interacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam interacoes"
  ON public.whatsapp_aquecimento_status_interacoes
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Donos veem interacoes"
  ON public.whatsapp_aquecimento_status_interacoes
  FOR SELECT TO authenticated
  USING (owns_whatsapp_instance(instancia_id));
