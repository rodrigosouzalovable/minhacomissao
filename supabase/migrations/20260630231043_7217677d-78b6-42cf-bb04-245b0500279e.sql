
-- 1. Colunas extras em meta_whatsapp_contatos
ALTER TABLE public.meta_whatsapp_contatos
  ADD COLUMN IF NOT EXISTS fixado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS arquivado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS historico_inicial_importado_em timestamptz;

-- 2. Colunas extras em meta_whatsapp_mensagens
ALTER TABLE public.meta_whatsapp_mensagens
  ADD COLUMN IF NOT EXISTS wa_message_id_reply text,
  ADD COLUMN IF NOT EXISTS conteudo_citado text,
  ADD COLUMN IF NOT EXISTS editada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS apagada_para_mim boolean NOT NULL DEFAULT false;

-- 3. Etiquetas Meta
CREATE TABLE IF NOT EXISTS public.meta_whatsapp_etiquetas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  cor text NOT NULL DEFAULT '#25D366',
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_whatsapp_etiquetas TO authenticated;
GRANT ALL ON public.meta_whatsapp_etiquetas TO service_role;

ALTER TABLE public.meta_whatsapp_etiquetas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meta_etiquetas_owner_all" ON public.meta_whatsapp_etiquetas
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER meta_etiquetas_updated_at BEFORE UPDATE ON public.meta_whatsapp_etiquetas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Vínculo contato <-> etiqueta
CREATE TABLE IF NOT EXISTS public.meta_whatsapp_contato_etiquetas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contato_id uuid NOT NULL REFERENCES public.meta_whatsapp_contatos(id) ON DELETE CASCADE,
  etiqueta_id uuid NOT NULL REFERENCES public.meta_whatsapp_etiquetas(id) ON DELETE CASCADE,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contato_id, etiqueta_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_whatsapp_contato_etiquetas TO authenticated;
GRANT ALL ON public.meta_whatsapp_contato_etiquetas TO service_role;

ALTER TABLE public.meta_whatsapp_contato_etiquetas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meta_contato_etiquetas_owner_all" ON public.meta_whatsapp_contato_etiquetas
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.meta_whatsapp_etiquetas e
      WHERE e.id = etiqueta_id AND e.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.meta_whatsapp_etiquetas e
      WHERE e.id = etiqueta_id AND e.user_id = auth.uid()
    )
  );

-- 5. Mensagens rápidas Meta
CREATE TABLE IF NOT EXISTS public.meta_whatsapp_mensagens_rapidas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  tipo text NOT NULL DEFAULT 'texto', -- texto | audio | botoes
  conteudo text,
  audio_url text,
  botoes_texto text,
  botoes_choices jsonb,
  ordem integer NOT NULL DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_whatsapp_mensagens_rapidas TO authenticated;
GRANT ALL ON public.meta_whatsapp_mensagens_rapidas TO service_role;

ALTER TABLE public.meta_whatsapp_mensagens_rapidas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meta_msg_rapidas_owner_all" ON public.meta_whatsapp_mensagens_rapidas
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER meta_msg_rapidas_updated_at BEFORE UPDATE ON public.meta_whatsapp_mensagens_rapidas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Realtime nas novas tabelas e nas colunas modificadas
ALTER PUBLICATION supabase_realtime ADD TABLE public.meta_whatsapp_etiquetas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meta_whatsapp_contato_etiquetas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meta_whatsapp_mensagens_rapidas;

-- 7. Índices
CREATE INDEX IF NOT EXISTS idx_meta_contatos_arquivado ON public.meta_whatsapp_contatos(arquivado);
CREATE INDEX IF NOT EXISTS idx_meta_contatos_fixado ON public.meta_whatsapp_contatos(fixado);
CREATE INDEX IF NOT EXISTS idx_meta_contato_etiquetas_contato ON public.meta_whatsapp_contato_etiquetas(contato_id);
CREATE INDEX IF NOT EXISTS idx_meta_msg_rapidas_user ON public.meta_whatsapp_mensagens_rapidas(user_id);
