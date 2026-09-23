CREATE TABLE public.template_favoritos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  template_tipo text NOT NULL,
  template_nome text NOT NULL,
  template_idioma text NOT NULL DEFAULT '',
  criado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT template_favoritos_tipo_nome_idioma_unique UNIQUE (user_id, template_tipo, template_nome, template_idioma)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.template_favoritos TO authenticated;
GRANT ALL ON public.template_favoritos TO service_role;

ALTER TABLE public.template_favoritos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own template favorites"
ON public.template_favoritos
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX template_favoritos_user_tipo_idx
ON public.template_favoritos (user_id, template_tipo);

COMMENT ON TABLE public.template_favoritos IS 'Preferencias de templates favoritos, isoladas por usuario e tipo de seletor.';