
CREATE TABLE IF NOT EXISTS public.cotacoes_moedas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL UNIQUE,
  usd numeric(10,4) NOT NULL,
  eur numeric(10,4) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cotacoes_moedas TO authenticated;
GRANT ALL ON public.cotacoes_moedas TO service_role;
ALTER TABLE public.cotacoes_moedas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins veem cotacoes" ON public.cotacoes_moedas FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE IF NOT EXISTS public.cotacoes_minimas (
  moeda text PRIMARY KEY,
  valor numeric(10,4) NOT NULL,
  data_registro date NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cotacoes_minimas TO authenticated;
GRANT ALL ON public.cotacoes_minimas TO service_role;
ALTER TABLE public.cotacoes_minimas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins veem minimas" ON public.cotacoes_minimas FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
