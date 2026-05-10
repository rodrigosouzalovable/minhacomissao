-- Tabela de configuração de notificações do admin
CREATE TABLE IF NOT EXISTS public.admin_notificacoes_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  admin_phone TEXT NOT NULL DEFAULT '5562991672674',
  notificar_chip_pausado BOOLEAN NOT NULL DEFAULT true,
  notificar_chip_desconectado BOOLEAN NOT NULL DEFAULT true,
  notificar_resumo_diario BOOLEAN NOT NULL DEFAULT true,
  notificar_proxies_faltando BOOLEAN NOT NULL DEFAULT true,
  ultima_instancia_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

ALTER TABLE public.admin_notificacoes_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam config notificacoes"
  ON public.admin_notificacoes_config
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.admin_notificacoes_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Log de notificações enviadas (idempotência + histórico)
CREATE TABLE IF NOT EXISTS public.admin_notificacoes_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,
  chave_idempotencia TEXT,
  mensagem TEXT NOT NULL,
  instancia_envio_id UUID,
  status TEXT NOT NULL DEFAULT 'enviado',
  erro_detalhe TEXT,
  enviado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_notif_idemp
  ON public.admin_notificacoes_log (tipo, chave_idempotencia)
  WHERE chave_idempotencia IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_admin_notif_enviado
  ON public.admin_notificacoes_log (enviado_em DESC);

ALTER TABLE public.admin_notificacoes_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins veem log notificacoes"
  ON public.admin_notificacoes_log
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Auto-pause inteligente: rastreia eventos por chip
CREATE TABLE IF NOT EXISTS public.whatsapp_chip_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instancia_id UUID NOT NULL,
  tipo_evento TEXT NOT NULL, -- 'desconexao', 'spam_report', 'queda'
  detalhe TEXT,
  registrado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chip_eventos_inst_data
  ON public.whatsapp_chip_eventos (instancia_id, registrado_em DESC);

ALTER TABLE public.whatsapp_chip_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam eventos chip"
  ON public.whatsapp_chip_eventos
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Coluna para rastrear pausa anti-ban com expiração
ALTER TABLE public.whatsapp_aquecimento_instancias
  ADD COLUMN IF NOT EXISTS pausado_ate TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pausado_motivo TEXT;