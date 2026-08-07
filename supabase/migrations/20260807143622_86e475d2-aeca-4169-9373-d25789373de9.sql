CREATE TABLE public.iago_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ativo boolean NOT NULL DEFAULT true,
  user_id uuid,
  persona_nome text NOT NULL DEFAULT 'Iago',
  tom text NOT NULL DEFAULT 'cordial, direto e humano, linguagem simples de WhatsApp',
  instrucoes_gerais text NOT NULL DEFAULT '',
  assina_nome boolean NOT NULL DEFAULT true,
  delay_digitacao_seg integer NOT NULL DEFAULT 4,
  followup_ativo boolean NOT NULL DEFAULT true,
  followup_horas integer NOT NULL DEFAULT 2,
  followup_hora_inicio integer NOT NULL DEFAULT 8,
  followup_hora_fim integer NOT NULL DEFAULT 19,
  followup_texto text NOT NULL DEFAULT '',
  limite_msgs_dia integer NOT NULL DEFAULT 20,
  aprendizado_auto boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.iago_config TO authenticated;
GRANT ALL ON public.iago_config TO service_role;
ALTER TABLE public.iago_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "iago_config admin" ON public.iago_config FOR ALL TO authenticated
  USING (public.is_admin_user(auth.uid())) WITH CHECK (public.is_admin_user(auth.uid()));

CREATE TABLE public.iago_conhecimento (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo text NOT NULL DEFAULT 'instrucao',
  gatilho text,
  conteudo text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  origem text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.iago_conhecimento TO authenticated;
GRANT ALL ON public.iago_conhecimento TO service_role;
ALTER TABLE public.iago_conhecimento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "iago_conhecimento admin" ON public.iago_conhecimento FOR ALL TO authenticated
  USING (public.is_admin_user(auth.uid())) WITH CHECK (public.is_admin_user(auth.uid()));
CREATE INDEX idx_iago_conhecimento_tipo ON public.iago_conhecimento (tipo, ativo);

CREATE TABLE public.iago_conversa_estado (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contato_id uuid NOT NULL UNIQUE,
  telefone text NOT NULL DEFAULT '',
  etapa text NOT NULL DEFAULT 'inicio',
  cpf text,
  aguardando_humano boolean NOT NULL DEFAULT false,
  optout boolean NOT NULL DEFAULT false,
  followup_em timestamptz,
  followup_feito boolean NOT NULL DEFAULT false,
  msgs_dia date,
  msgs_hoje integer NOT NULL DEFAULT 0,
  ultima_msg_cliente_em timestamptz,
  ultima_msg_em timestamptz,
  contexto jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.iago_conversa_estado TO authenticated;
GRANT ALL ON public.iago_conversa_estado TO service_role;
ALTER TABLE public.iago_conversa_estado ENABLE ROW LEVEL SECURITY;
CREATE POLICY "iago_conversa_estado admin" ON public.iago_conversa_estado FOR ALL TO authenticated
  USING (public.is_admin_user(auth.uid())) WITH CHECK (public.is_admin_user(auth.uid()));
CREATE INDEX idx_iago_estado_followup ON public.iago_conversa_estado (followup_em) WHERE followup_feito = false;

CREATE TRIGGER trg_iago_config_updated BEFORE UPDATE ON public.iago_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_iago_conhecimento_updated BEFORE UPDATE ON public.iago_conhecimento
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_iago_conversa_estado_updated BEFORE UPDATE ON public.iago_conversa_estado
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.iago_config (instrucoes_gerais, followup_texto)
VALUES (
  'Você é Iago, analista de cobrança da equipe. Fale como uma pessoa real no WhatsApp: mensagens curtas, sem formalidade excessiva, sem se apresentar como robô ou assistente virtual. Nunca invente valores, prazos ou descontos: use apenas os dados fornecidos pelo sistema.',
  'Oi, tudo bem? Só passando pra saber se você conseguiu ver a proposta que te mandei.'
);