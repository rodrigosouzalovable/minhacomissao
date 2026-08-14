CREATE TABLE public.iago_plantao_transferencia (
  contato_id UUID NOT NULL PRIMARY KEY,
  etiqueta_original_id UUID NOT NULL,
  folder_id UUID,
  assumido_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  devolvido_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.iago_plantao_transferencia TO authenticated;
GRANT ALL ON public.iago_plantao_transferencia TO service_role;

ALTER TABLE public.iago_plantao_transferencia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin gerencia transferencias do plantao IAGO"
ON public.iago_plantao_transferencia
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_iago_plantao_transf_pendentes
ON public.iago_plantao_transferencia (devolvido_em)
WHERE devolvido_em IS NULL;

CREATE TRIGGER trg_iago_plantao_transferencia_updated_at
BEFORE UPDATE ON public.iago_plantao_transferencia
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();