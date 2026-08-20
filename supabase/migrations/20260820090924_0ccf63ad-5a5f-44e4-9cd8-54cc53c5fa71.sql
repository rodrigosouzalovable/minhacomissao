CREATE TABLE public.whatsapp_chamadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contato_id uuid REFERENCES public.meta_whatsapp_contatos(id) ON DELETE SET NULL,
  instancia_id uuid REFERENCES public.meta_whatsapp_instances(id) ON DELETE SET NULL,
  funcionario_id uuid,
  waba_id text,
  phone_number_id text,
  telefone text NOT NULL,
  call_id text,
  tipo_chamada text NOT NULL DEFAULT 'saida',
  status text NOT NULL DEFAULT 'iniciada',
  duracao_segundos integer NOT NULL DEFAULT 0,
  data_inicio timestamptz NOT NULL DEFAULT now(),
  data_fim timestamptz,
  custo_estimado numeric(10,4),
  erro text,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_wa_chamadas_contato ON public.whatsapp_chamadas(contato_id);
CREATE UNIQUE INDEX idx_wa_chamadas_call_id ON public.whatsapp_chamadas(call_id) WHERE call_id IS NOT NULL;
CREATE INDEX idx_wa_chamadas_data ON public.whatsapp_chamadas(data_inicio DESC);
CREATE INDEX idx_wa_chamadas_tel ON public.whatsapp_chamadas(telefone);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_chamadas TO authenticated;
GRANT ALL ON public.whatsapp_chamadas TO service_role;
ALTER TABLE public.whatsapp_chamadas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chamadas_select" ON public.whatsapp_chamadas FOR SELECT TO authenticated
  USING (instancia_id IS NULL OR public.pode_ver_instancia_meta(auth.uid(), instancia_id));
CREATE POLICY "chamadas_insert" ON public.whatsapp_chamadas FOR INSERT TO authenticated
  WITH CHECK (instancia_id IS NULL OR public.pode_ver_instancia_meta(auth.uid(), instancia_id));
CREATE POLICY "chamadas_update" ON public.whatsapp_chamadas FOR UPDATE TO authenticated
  USING (instancia_id IS NULL OR public.pode_ver_instancia_meta(auth.uid(), instancia_id));
CREATE POLICY "chamadas_delete_admin" ON public.whatsapp_chamadas FOR DELETE TO authenticated
  USING (public.is_admin_user(auth.uid()));

CREATE TABLE public.meta_call_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contato_id uuid REFERENCES public.meta_whatsapp_contatos(id) ON DELETE CASCADE,
  instancia_id uuid REFERENCES public.meta_whatsapp_instances(id) ON DELETE CASCADE,
  telefone text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  expira_em timestamptz,
  solicitado_em timestamptz,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_call_perm_inst_tel ON public.meta_call_permissions(instancia_id, telefone);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_call_permissions TO authenticated;
GRANT ALL ON public.meta_call_permissions TO service_role;
ALTER TABLE public.meta_call_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "call_perm_select" ON public.meta_call_permissions FOR SELECT TO authenticated
  USING (instancia_id IS NULL OR public.pode_ver_instancia_meta(auth.uid(), instancia_id));
CREATE POLICY "call_perm_write" ON public.meta_call_permissions FOR ALL TO authenticated
  USING (instancia_id IS NULL OR public.pode_ver_instancia_meta(auth.uid(), instancia_id))
  WITH CHECK (instancia_id IS NULL OR public.pode_ver_instancia_meta(auth.uid(), instancia_id));

ALTER TABLE public.meta_whatsapp_instances ADD COLUMN IF NOT EXISTS chamadas_habilitadas boolean NOT NULL DEFAULT false;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_chamadas;