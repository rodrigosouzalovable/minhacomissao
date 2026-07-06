
-- =========================================================
-- Envio Meta Massa: jobs persistentes
-- =========================================================

CREATE TABLE IF NOT EXISTS public.envio_meta_job (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'rodando', -- rodando | pausado | concluido | cancelado | erro
  status_motivo text,
  template_id uuid,
  template_nome text,
  template_id_by_instance jsonb NOT NULL DEFAULT '{}'::jsonb,
  instancia_ids uuid[] NOT NULL DEFAULT '{}',
  min_seg integer NOT NULL DEFAULT 30,
  max_seg integer NOT NULL DEFAULT 90,
  total integer NOT NULL DEFAULT 0,
  enviados integer NOT NULL DEFAULT 0,
  erros integer NOT NULL DEFAULT 0,
  atual_telefone text,
  atual_instancia text,
  proximo_em timestamptz,
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  concluido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.envio_meta_job TO authenticated;
GRANT ALL ON public.envio_meta_job TO service_role;

ALTER TABLE public.envio_meta_job ENABLE ROW LEVEL SECURITY;

CREATE POLICY "envio_meta_job_owner_select" ON public.envio_meta_job
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "envio_meta_job_owner_insert" ON public.envio_meta_job
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "envio_meta_job_owner_update" ON public.envio_meta_job
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "envio_meta_job_owner_delete" ON public.envio_meta_job
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS envio_meta_job_user_status_idx
  ON public.envio_meta_job(user_id, status, iniciado_em DESC);
CREATE INDEX IF NOT EXISTS envio_meta_job_status_proximo_idx
  ON public.envio_meta_job(status, proximo_em)
  WHERE status IN ('rodando','pausado');

CREATE TRIGGER envio_meta_job_updated_at
  BEFORE UPDATE ON public.envio_meta_job
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Itens do job
CREATE TABLE IF NOT EXISTS public.envio_meta_job_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.envio_meta_job(id) ON DELETE CASCADE,
  ordem integer NOT NULL,
  telefone text NOT NULL,
  nome text,
  cpf text,
  atraso text,
  saldo numeric,
  status text NOT NULL DEFAULT 'pendente', -- pendente | enviado | erro | pulado
  instancia_id uuid,
  instancia_nome text,
  erro text,
  processado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.envio_meta_job_item TO authenticated;
GRANT ALL ON public.envio_meta_job_item TO service_role;

ALTER TABLE public.envio_meta_job_item ENABLE ROW LEVEL SECURITY;

CREATE POLICY "envio_meta_job_item_owner_select" ON public.envio_meta_job_item
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.envio_meta_job j WHERE j.id = envio_meta_job_item.job_id AND j.user_id = auth.uid())
  );
CREATE POLICY "envio_meta_job_item_owner_insert" ON public.envio_meta_job_item
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.envio_meta_job j WHERE j.id = envio_meta_job_item.job_id AND j.user_id = auth.uid())
  );
CREATE POLICY "envio_meta_job_item_owner_update" ON public.envio_meta_job_item
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.envio_meta_job j WHERE j.id = envio_meta_job_item.job_id AND j.user_id = auth.uid())
  );
CREATE POLICY "envio_meta_job_item_owner_delete" ON public.envio_meta_job_item
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.envio_meta_job j WHERE j.id = envio_meta_job_item.job_id AND j.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS envio_meta_job_item_job_status_idx
  ON public.envio_meta_job_item(job_id, status, ordem);
CREATE INDEX IF NOT EXISTS envio_meta_job_item_pendentes_idx
  ON public.envio_meta_job_item(job_id, ordem)
  WHERE status = 'pendente';

CREATE TRIGGER envio_meta_job_item_updated_at
  BEFORE UPDATE ON public.envio_meta_job_item
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.envio_meta_job;
ALTER PUBLICATION supabase_realtime ADD TABLE public.envio_meta_job_item;
