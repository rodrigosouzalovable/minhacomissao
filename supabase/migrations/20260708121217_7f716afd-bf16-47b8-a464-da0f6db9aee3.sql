
CREATE TABLE IF NOT EXISTS public.consulta_cpf_notificacoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cpf text NOT NULL,
  nome text,
  credor text,
  total_debitos integer NOT NULL DEFAULT 0,
  telefones text,
  assigned_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lida_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.consulta_cpf_notificacoes TO authenticated;
GRANT ALL ON public.consulta_cpf_notificacoes TO service_role;

ALTER TABLE public.consulta_cpf_notificacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "consulta_cpf_notif_select" ON public.consulta_cpf_notificacoes;
CREATE POLICY "consulta_cpf_notif_select"
  ON public.consulta_cpf_notificacoes FOR SELECT
  USING (
    assigned_user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "consulta_cpf_notif_update" ON public.consulta_cpf_notificacoes;
CREATE POLICY "consulta_cpf_notif_update"
  ON public.consulta_cpf_notificacoes FOR UPDATE
  USING (
    assigned_user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  WITH CHECK (
    assigned_user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE INDEX IF NOT EXISTS idx_consulta_cpf_notif_user_created
  ON public.consulta_cpf_notificacoes (assigned_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consulta_cpf_notif_user_lida
  ON public.consulta_cpf_notificacoes (assigned_user_id, lida_em);

DROP TRIGGER IF EXISTS trg_consulta_cpf_notif_updated ON public.consulta_cpf_notificacoes;
CREATE TRIGGER trg_consulta_cpf_notif_updated
  BEFORE UPDATE ON public.consulta_cpf_notificacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.consulta_cpf_notificacoes;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
