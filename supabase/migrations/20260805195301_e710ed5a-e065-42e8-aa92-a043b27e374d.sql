-- 1) Config
CREATE TABLE public.meta_ia_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id uuid REFERENCES public.meta_inbox_folders(id) ON DELETE CASCADE,
  ativo boolean NOT NULL DEFAULT false,
  desconto_avista_pct numeric NOT NULL DEFAULT 50,
  desconto_parcelado_pct numeric NOT NULL DEFAULT 30,
  max_parcelas integer NOT NULL DEFAULT 24,
  parcela_minima numeric NOT NULL DEFAULT 100,
  hora_inicio integer NOT NULL DEFAULT 8,
  hora_fim integer NOT NULL DEFAULT 20,
  limite_msgs_dia integer NOT NULL DEFAULT 20,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX meta_ia_config_folder_uniq ON public.meta_ia_config (COALESCE(folder_id, '00000000-0000-0000-0000-000000000000'::uuid));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_ia_config TO authenticated;
GRANT ALL ON public.meta_ia_config TO service_role;
ALTER TABLE public.meta_ia_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ia config admin all" ON public.meta_ia_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER meta_ia_config_touch BEFORE UPDATE ON public.meta_ia_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Templates
CREATE TABLE public.meta_ia_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etapa text NOT NULL UNIQUE,
  descricao text NOT NULL DEFAULT '',
  template text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_ia_templates TO authenticated;
GRANT ALL ON public.meta_ia_templates TO service_role;
ALTER TABLE public.meta_ia_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ia templates admin all" ON public.meta_ia_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER meta_ia_templates_touch BEFORE UPDATE ON public.meta_ia_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Contatos de emergência
CREATE TABLE public.meta_ia_contatos_emergencia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL DEFAULT '',
  telefone text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_ia_contatos_emergencia TO authenticated;
GRANT ALL ON public.meta_ia_contatos_emergencia TO service_role;
ALTER TABLE public.meta_ia_contatos_emergencia ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ia contatos admin all" ON public.meta_ia_contatos_emergencia FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER meta_ia_contatos_touch BEFORE UPDATE ON public.meta_ia_contatos_emergencia
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Estado por conversa
CREATE TABLE public.meta_ia_conversas_estado (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contato_id uuid NOT NULL REFERENCES public.meta_whatsapp_contatos(id) ON DELETE CASCADE,
  telefone text NOT NULL,
  etapa text NOT NULL DEFAULT 'inicio',
  cpf text,
  aguardando_humano boolean NOT NULL DEFAULT false,
  msgs_hoje integer NOT NULL DEFAULT 0,
  msgs_dia date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  ultima_msg_em timestamptz,
  contexto jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contato_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_ia_conversas_estado TO authenticated;
GRANT ALL ON public.meta_ia_conversas_estado TO service_role;
ALTER TABLE public.meta_ia_conversas_estado ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ia estado admin all" ON public.meta_ia_conversas_estado FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "ia estado membros select" ON public.meta_ia_conversas_estado FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.meta_whatsapp_contatos c
    WHERE c.id = meta_ia_conversas_estado.contato_id
      AND public.can_view_meta_contato_folder(auth.uid(), c.folder_id)
  ));
CREATE TRIGGER meta_ia_estado_touch BEFORE UPDATE ON public.meta_ia_conversas_estado
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) Seeds
INSERT INTO public.meta_ia_contatos_emergencia (nome, telefone) VALUES ('Admin', '62991672674');

INSERT INTO public.meta_ia_templates (etapa, descricao, template) VALUES
('pedir_cpf', 'Quando não identifica o cliente pelo telefone', 'Olá! 👋 Aqui é o atendimento da Souza e Ribeiro Negociações. Para consultar sua situação, me informe por favor o seu *CPF* (somente números).'),
('proposta', 'Proposta enviada quando o cliente não possui acordo lançado', 'Perfeito, {primeiro_nome}! Localizei seu débito com {credor} no valor de {valor_total}.

Temos as seguintes condições:

💵 *À vista:* {valor_avista} ({desconto_avista_pct}% de desconto)
📋 *Parcelado:* até {max_parcelas}x de {valor_parcela} (total {valor_parcelado})

Qual opção fica melhor para você: *à vista* ou *parcelado*?'),
('sem_debitos', 'CPF sem débitos ativos', 'Consultei aqui e não localizei débitos em aberto no CPF informado. Se precisar de algo mais, estou à disposição! 😊'),
('cpf_invalido', 'CPF inválido ou não localizado', 'Não consegui localizar esse CPF. Pode conferir e me enviar novamente, por favor? (somente números)'),
('ja_tem_acordo', 'Cliente já possui acordo lançado', 'Olá, {primeiro_nome}! Localizei aqui que você já possui uma negociação em nosso sistema. Um de nossos atendentes vai falar com você em instantes para dar sequência, tudo bem? 🙏'),
('confirmacao_escolha', 'Cliente escolheu à vista ou parcelado', 'Ótima escolha, {primeiro_nome}! Já estou encaminhando para um de nossos atendentes finalizar seu acordo e enviar o boleto. Só um momento, por favor. 🙌'),
('fora_horario', 'Mensagem recebida fora do horário de atendimento', 'Olá! Recebi sua mensagem. 😊 Nosso atendimento funciona das 8h às 20h e retornaremos o seu contato assim que possível.');

INSERT INTO public.meta_ia_config (ativo) VALUES (false);