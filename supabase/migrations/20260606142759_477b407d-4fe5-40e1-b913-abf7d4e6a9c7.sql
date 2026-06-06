
-- notificacoes_config (singleton-like)
CREATE TABLE public.notificacoes_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instancia_id uuid REFERENCES public.user_whatsapp_instances(id) ON DELETE SET NULL,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notificacoes_config TO authenticated;
GRANT ALL ON public.notificacoes_config TO service_role;
ALTER TABLE public.notificacoes_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage notificacoes_config" ON public.notificacoes_config
  FOR ALL TO authenticated
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

-- notificacoes_operador_telefone
CREATE TABLE public.notificacoes_operador_telefone (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  telefone text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notificacoes_operador_telefone TO authenticated;
GRANT ALL ON public.notificacoes_operador_telefone TO service_role;
ALTER TABLE public.notificacoes_operador_telefone ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage notificacoes_operador_telefone" ON public.notificacoes_operador_telefone
  FOR ALL TO authenticated
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));
CREATE POLICY "Operador ve proprio telefone" ON public.notificacoes_operador_telefone
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- notificacoes_envios_log
CREATE TABLE public.notificacoes_envios_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pagamento_id uuid NOT NULL REFERENCES public.pagamentos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('D-1','D0')),
  data_ref date NOT NULL,
  telefone text,
  sucesso boolean NOT NULL DEFAULT true,
  erro text,
  enviado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pagamento_id, tipo, data_ref)
);
CREATE INDEX idx_notificacoes_envios_data_ref ON public.notificacoes_envios_log(data_ref);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notificacoes_envios_log TO authenticated;
GRANT ALL ON public.notificacoes_envios_log TO service_role;
ALTER TABLE public.notificacoes_envios_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins ver log notificacoes" ON public.notificacoes_envios_log
  FOR SELECT TO authenticated
  USING (public.is_admin_user(auth.uid()));

-- updated_at triggers
CREATE TRIGGER trg_notificacoes_config_updated
  BEFORE UPDATE ON public.notificacoes_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_notificacoes_operador_telefone_updated
  BEFORE UPDATE ON public.notificacoes_operador_telefone
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
