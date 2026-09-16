CREATE TABLE public.google_maps_scripts_usuario (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  script_texto text NOT NULL,
  objecoes jsonb NOT NULL DEFAULT '[]'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT google_maps_scripts_usuario_objecoes_array CHECK (jsonb_typeof(objecoes) = 'array')
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_maps_scripts_usuario TO authenticated;
GRANT ALL ON public.google_maps_scripts_usuario TO service_role;
ALTER TABLE public.google_maps_scripts_usuario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gm_scripts_proprio_select"
ON public.google_maps_scripts_usuario
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  AND (public.has_role(auth.uid(), 'admin') OR NOT public.is_parceiro_meta(auth.uid()))
);

CREATE POLICY "gm_scripts_proprio_insert"
ON public.google_maps_scripts_usuario
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (public.has_role(auth.uid(), 'admin') OR NOT public.is_parceiro_meta(auth.uid()))
);

CREATE POLICY "gm_scripts_proprio_update"
ON public.google_maps_scripts_usuario
FOR UPDATE TO authenticated
USING (
  user_id = auth.uid()
  AND (public.has_role(auth.uid(), 'admin') OR NOT public.is_parceiro_meta(auth.uid()))
)
WITH CHECK (
  user_id = auth.uid()
  AND (public.has_role(auth.uid(), 'admin') OR NOT public.is_parceiro_meta(auth.uid()))
);

CREATE POLICY "gm_scripts_proprio_delete"
ON public.google_maps_scripts_usuario
FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  AND (public.has_role(auth.uid(), 'admin') OR NOT public.is_parceiro_meta(auth.uid()))
);