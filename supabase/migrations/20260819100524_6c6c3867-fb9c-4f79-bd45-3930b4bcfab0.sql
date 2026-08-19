CREATE TABLE public.virtualsms_pedidos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE,
  servico TEXT NOT NULL,
  pais TEXT,
  numero TEXT,
  codigo TEXT,
  status TEXT NOT NULL DEFAULT 'aguardando',
  custo NUMERIC(10,4),
  expira_em TIMESTAMPTZ,
  criado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.virtualsms_pedidos TO authenticated;
GRANT ALL ON public.virtualsms_pedidos TO service_role;
ALTER TABLE public.virtualsms_pedidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins gerenciam pedidos virtualsms" ON public.virtualsms_pedidos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_virtualsms_pedidos_created_at ON public.virtualsms_pedidos (created_at DESC);

CREATE TABLE public.virtualsms_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  limite_mensal_usd NUMERIC(10,2) NOT NULL DEFAULT 20,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.virtualsms_config TO authenticated;
GRANT ALL ON public.virtualsms_config TO service_role;
ALTER TABLE public.virtualsms_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins gerenciam config virtualsms" ON public.virtualsms_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.virtualsms_config (limite_mensal_usd) VALUES (20);