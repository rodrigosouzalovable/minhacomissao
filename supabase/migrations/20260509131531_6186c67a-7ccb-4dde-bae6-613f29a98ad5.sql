
-- Pool de diálogos para conversa intra-grupo de aquecimento
CREATE TABLE public.whatsapp_aquecimento_grupo_dialogos_pool (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contexto text NOT NULL,
  ordem_na_cena integer NOT NULL DEFAULT 0,
  tipo text NOT NULL DEFAULT 'texto',
  conteudo text NOT NULL,
  peso integer NOT NULL DEFAULT 1,
  ativo boolean NOT NULL DEFAULT true,
  vezes_utilizada integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT chk_grupo_dialogo_tipo CHECK (tipo IN ('texto','audio','imagem'))
);
CREATE INDEX idx_grupo_dialogos_contexto ON public.whatsapp_aquecimento_grupo_dialogos_pool(contexto, ativo, ordem_na_cena);
ALTER TABLE public.whatsapp_aquecimento_grupo_dialogos_pool ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins gerenciam pool conversa grupo" ON public.whatsapp_aquecimento_grupo_dialogos_pool
  FOR ALL TO authenticated USING (is_admin_user(auth.uid())) WITH CHECK (is_admin_user(auth.uid()));
CREATE POLICY "Auth pode ler pool conversa grupo" ON public.whatsapp_aquecimento_grupo_dialogos_pool
  FOR SELECT TO authenticated USING (true);

-- Log de mensagens enviadas no grupo
CREATE TABLE public.whatsapp_aquecimento_grupo_conversas_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  grupo_id uuid NOT NULL REFERENCES public.whatsapp_aquecimento_grupos(id) ON DELETE CASCADE,
  instancia_id uuid NOT NULL REFERENCES public.user_whatsapp_instances(id) ON DELETE CASCADE,
  contexto text,
  tipo text NOT NULL,
  conteudo_preview text,
  enviado_em timestamp with time zone NOT NULL DEFAULT now(),
  sucesso boolean NOT NULL DEFAULT true,
  erro text
);
CREATE INDEX idx_grupo_conversas_log_grupo_dia ON public.whatsapp_aquecimento_grupo_conversas_log(grupo_id, enviado_em DESC);
CREATE INDEX idx_grupo_conversas_log_instancia_dia ON public.whatsapp_aquecimento_grupo_conversas_log(instancia_id, enviado_em DESC);
ALTER TABLE public.whatsapp_aquecimento_grupo_conversas_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins gerenciam log conversa grupo" ON public.whatsapp_aquecimento_grupo_conversas_log
  FOR ALL TO authenticated USING (is_admin_user(auth.uid())) WITH CHECK (is_admin_user(auth.uid()));
CREATE POLICY "Auth pode ler log conversa grupo" ON public.whatsapp_aquecimento_grupo_conversas_log
  FOR SELECT TO authenticated USING (true);

-- Config por grupo
CREATE TABLE public.whatsapp_aquecimento_grupo_config (
  grupo_id uuid NOT NULL PRIMARY KEY REFERENCES public.whatsapp_aquecimento_grupos(id) ON DELETE CASCADE,
  ativo boolean NOT NULL DEFAULT true,
  msgs_min_dia integer NOT NULL DEFAULT 15,
  msgs_max_dia integer NOT NULL DEFAULT 25,
  mix_texto integer NOT NULL DEFAULT 70,
  mix_audio integer NOT NULL DEFAULT 20,
  mix_imagem integer NOT NULL DEFAULT 10,
  carencia_horas integer NOT NULL DEFAULT 24,
  max_msgs_por_instancia_dia integer NOT NULL DEFAULT 6,
  max_audios_por_instancia_dia integer NOT NULL DEFAULT 2,
  max_imagens_por_instancia_dia integer NOT NULL DEFAULT 1,
  atualizado_em timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.whatsapp_aquecimento_grupo_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins gerenciam config conversa grupo" ON public.whatsapp_aquecimento_grupo_config
  FOR ALL TO authenticated USING (is_admin_user(auth.uid())) WITH CHECK (is_admin_user(auth.uid()));
CREATE POLICY "Auth pode ler config conversa grupo" ON public.whatsapp_aquecimento_grupo_config
  FOR SELECT TO authenticated USING (true);
CREATE TRIGGER trg_grupo_conversa_config_updated BEFORE UPDATE ON public.whatsapp_aquecimento_grupo_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
