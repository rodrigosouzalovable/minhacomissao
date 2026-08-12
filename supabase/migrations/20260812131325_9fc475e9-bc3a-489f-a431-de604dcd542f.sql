CREATE TABLE public.credor_desconto_faixas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  credor text NOT NULL,
  dias_de integer NOT NULL DEFAULT 0,
  dias_ate integer,
  desc_avista numeric NOT NULL DEFAULT 0,
  desc_parcelado numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_credor_desconto_faixas_credor ON public.credor_desconto_faixas (credor, dias_de);

GRANT SELECT ON public.credor_desconto_faixas TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.credor_desconto_faixas TO authenticated;
GRANT ALL ON public.credor_desconto_faixas TO service_role;

ALTER TABLE public.credor_desconto_faixas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Faixas de desconto sao publicas para leitura"
ON public.credor_desconto_faixas FOR SELECT
USING (true);

CREATE POLICY "Admins podem gerenciar faixas de desconto"
ON public.credor_desconto_faixas FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_credor_desconto_faixas_updated_at
BEFORE UPDATE ON public.credor_desconto_faixas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();