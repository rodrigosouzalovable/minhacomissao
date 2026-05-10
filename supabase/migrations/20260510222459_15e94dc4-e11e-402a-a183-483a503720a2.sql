
CREATE TABLE IF NOT EXISTS public.whatsapp_perfil_completacao_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instancia_id uuid NOT NULL,
  acao text NOT NULL,
  valor_aplicado text,
  status text NOT NULL DEFAULT 'sucesso',
  erro text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_perfil_log_instancia ON public.whatsapp_perfil_completacao_log(instancia_id);
CREATE INDEX IF NOT EXISTS idx_perfil_log_criado ON public.whatsapp_perfil_completacao_log(criado_em DESC);

ALTER TABLE public.whatsapp_perfil_completacao_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins veem log perfil" ON public.whatsapp_perfil_completacao_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role gerencia log perfil" ON public.whatsapp_perfil_completacao_log
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

INSERT INTO public.whatsapp_aquecimento_config (chave, valor) VALUES
  ('perfil_foto_url', to_jsonb('https://cymdrkeukockakfzjeen.supabase.co/storage/v1/object/public/aquecimento-status-images/perfil%2Fsouza-ribeiro-novomundo.png'::text)),
  ('perfil_nome_pool', to_jsonb(ARRAY[
    'Atendimento Souza & Ribeiro',
    'Souza Ribeiro Cobranças',
    'Central Souza Ribeiro',
    'Negociação Souza Ribeiro',
    'Souza Ribeiro Advocacia',
    'Atendente SR',
    'Souza Ribeiro - Acordos',
    'Negociador SR'
  ])),
  ('perfil_sobre_pool', to_jsonb(ARRAY[
    'Souza e Ribeiro Advocacia e Cobrança',
    'Negocie seu acordo com a gente',
    'Atendimento de segunda a sexta',
    'Resolva sua pendência conosco',
    'Aqui para te ajudar a negociar',
    'Souza e Ribeiro - Acordos e Negociação'
  ])),
  ('perfil_completacao_ativo', to_jsonb(true))
ON CONFLICT (chave) DO NOTHING;
