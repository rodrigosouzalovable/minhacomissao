
-- =========================================================
-- Inbox Meta: tabelas dedicadas para conversas via API oficial
-- =========================================================

CREATE TABLE IF NOT EXISTS public.meta_whatsapp_contatos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instancia_id uuid NOT NULL REFERENCES public.meta_whatsapp_instances(id) ON DELETE CASCADE,
  telefone text NOT NULL,
  nome text,
  ultima_mensagem text,
  ultima_mensagem_em timestamptz,
  nao_lido integer NOT NULL DEFAULT 0,
  ultima_msg_entrada_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instancia_id, telefone)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_whatsapp_contatos TO authenticated;
GRANT ALL ON public.meta_whatsapp_contatos TO service_role;

ALTER TABLE public.meta_whatsapp_contatos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner can manage meta contatos" ON public.meta_whatsapp_contatos
  FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.is_admin_user(auth.uid()))
  WITH CHECK (auth.uid() = user_id OR public.is_admin_user(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_meta_contatos_user_inst ON public.meta_whatsapp_contatos(user_id, instancia_id, ultima_mensagem_em DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS public.meta_whatsapp_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instancia_id uuid NOT NULL REFERENCES public.meta_whatsapp_instances(id) ON DELETE CASCADE,
  telefone text NOT NULL,
  direcao text NOT NULL CHECK (direcao IN ('entrada','saida')),
  conteudo text NOT NULL DEFAULT '',
  tipo_conteudo text NOT NULL DEFAULT 'texto',
  media_url text,
  timestamp_msg timestamptz NOT NULL DEFAULT now(),
  status_envio text NOT NULL DEFAULT 'enviada'
    CHECK (status_envio IN ('enviando','enviada','entregue','lida','erro')),
  wa_message_id text,
  template_nome text,
  erro text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instancia_id, wa_message_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_whatsapp_mensagens TO authenticated;
GRANT ALL ON public.meta_whatsapp_mensagens TO service_role;

ALTER TABLE public.meta_whatsapp_mensagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner can manage meta mensagens" ON public.meta_whatsapp_mensagens
  FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.is_admin_user(auth.uid()))
  WITH CHECK (auth.uid() = user_id OR public.is_admin_user(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_meta_mensagens_thread
  ON public.meta_whatsapp_mensagens(instancia_id, telefone, timestamp_msg DESC);

CREATE INDEX IF NOT EXISTS idx_meta_mensagens_wamid
  ON public.meta_whatsapp_mensagens(wa_message_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.meta_whatsapp_mensagens;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meta_whatsapp_contatos;
