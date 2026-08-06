ALTER TABLE public.relatorio_acionamentos
  ADD COLUMN IF NOT EXISTS cpc_whatsapp_auto integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cpc_ligacao_auto integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cpc_portal_auto integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.relatorio_destinos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo text NOT NULL DEFAULT 'grupo',
  jid text NOT NULL,
  nome text,
  instancia_id uuid,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (jid)
);

GRANT SELECT ON public.relatorio_destinos TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.relatorio_destinos TO authenticated;
GRANT ALL ON public.relatorio_destinos TO service_role;

ALTER TABLE public.relatorio_destinos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "relatorio_destinos_select_auth" ON public.relatorio_destinos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "relatorio_destinos_admin_all" ON public.relatorio_destinos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_relatorio_destinos_updated_at
  BEFORE UPDATE ON public.relatorio_destinos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();