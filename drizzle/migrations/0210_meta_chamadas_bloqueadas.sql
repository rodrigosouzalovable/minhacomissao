CREATE TABLE public.meta_chamadas_bloqueadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sufixo text NOT NULL UNIQUE,
  telefone text,
  bloqueado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.meta_chamadas_bloqueadas TO authenticated;
GRANT ALL ON public.meta_chamadas_bloqueadas TO service_role;
ALTER TABLE public.meta_chamadas_bloqueadas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chamadas_bloqueadas_select" ON public.meta_chamadas_bloqueadas FOR SELECT TO authenticated USING (true);
CREATE POLICY "chamadas_bloqueadas_insert" ON public.meta_chamadas_bloqueadas FOR INSERT TO authenticated WITH CHECK (bloqueado_por = auth.uid() AND length(sufixo) = 8);
CREATE POLICY "chamadas_bloqueadas_delete" ON public.meta_chamadas_bloqueadas FOR DELETE TO authenticated USING (true);