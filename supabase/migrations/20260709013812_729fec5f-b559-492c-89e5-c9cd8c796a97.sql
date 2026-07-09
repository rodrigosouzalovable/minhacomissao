
CREATE TABLE IF NOT EXISTS public.meta_business_managers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  app_id text NOT NULL UNIQUE,
  business_id text,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  padrao boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_business_managers TO authenticated;
GRANT ALL ON public.meta_business_managers TO service_role;

ALTER TABLE public.meta_business_managers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view business managers"
  ON public.meta_business_managers FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert business managers"
  ON public.meta_business_managers FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update business managers"
  ON public.meta_business_managers FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete business managers"
  ON public.meta_business_managers FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE UNIQUE INDEX IF NOT EXISTS meta_business_managers_unique_padrao
  ON public.meta_business_managers ((true))
  WHERE padrao = true;

CREATE TRIGGER meta_business_managers_updated_at
  BEFORE UPDATE ON public.meta_business_managers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.meta_whatsapp_instances
  ADD COLUMN IF NOT EXISTS meta_bm_id uuid REFERENCES public.meta_business_managers(id) ON DELETE SET NULL;

INSERT INTO public.meta_business_managers (nome, app_id, descricao, ativo, padrao)
VALUES ('BM Principal', '1041751302126373', 'BM padrão inicial', true, true)
ON CONFLICT (app_id) DO NOTHING;

INSERT INTO public.meta_business_managers (nome, app_id, descricao, ativo, padrao)
VALUES ('BM Secundária', '2328366971280850', 'Segunda BM cadastrada', true, false)
ON CONFLICT (app_id) DO NOTHING;
