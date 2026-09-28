CREATE TABLE public.meta_inbox_folder_etiquetas (
  folder_id uuid NOT NULL REFERENCES public.meta_inbox_folders(id) ON DELETE CASCADE,
  etiqueta_id uuid NOT NULL REFERENCES public.meta_whatsapp_etiquetas(id) ON DELETE CASCADE,
  nome text,
  cor text,
  ativa boolean NOT NULL DEFAULT true,
  exclusiva boolean NOT NULL DEFAULT false,
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (folder_id, etiqueta_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_inbox_folder_etiquetas TO authenticated;
GRANT ALL ON public.meta_inbox_folder_etiquetas TO service_role;

ALTER TABLE public.meta_inbox_folder_etiquetas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "folder label members read"
ON public.meta_inbox_folder_etiquetas
FOR SELECT TO authenticated
USING (public.can_access_meta_folder(auth.uid(), folder_id));

CREATE POLICY "folder label admins manage"
ON public.meta_inbox_folder_etiquetas
FOR ALL TO authenticated
USING (public.meta_inbox_folder_can_manage(auth.uid(), folder_id))
WITH CHECK (public.meta_inbox_folder_can_manage(auth.uid(), folder_id));

CREATE INDEX idx_meta_inbox_folder_etiquetas_etiqueta
ON public.meta_inbox_folder_etiquetas (etiqueta_id, folder_id);

CREATE OR REPLACE FUNCTION public.meta_etiquetas_da_caixa(_folder uuid)
RETURNS TABLE(id uuid, nome text, cor text, ativa boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.id,
    COALESCE(local.nome, e.nome) AS nome,
    COALESCE(local.cor, e.cor) AS cor,
    COALESCE(local.ativa, e.ativa) AS ativa
  FROM public.meta_whatsapp_etiquetas e
  LEFT JOIN public.meta_inbox_folder_etiquetas local
    ON local.etiqueta_id = e.id
   AND local.folder_id = _folder
  WHERE auth.uid() IS NOT NULL
    AND (_folder IS NULL OR public.can_access_meta_folder(auth.uid(), _folder))
    AND NOT EXISTS (
      SELECT 1
      FROM public.meta_inbox_folder_etiquetas exclusiva
      WHERE exclusiva.etiqueta_id = e.id
        AND exclusiva.exclusiva = true
        AND (_folder IS NULL OR exclusiva.folder_id <> _folder)
    )
  ORDER BY COALESCE(local.nome, e.nome);
$$;

REVOKE ALL ON FUNCTION public.meta_etiquetas_da_caixa(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.meta_etiquetas_da_caixa(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.meta_etiquetas_da_caixa(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.meta_etiqueta_caixa_salvar(
  _folder uuid,
  _etiqueta uuid,
  _nome text,
  _cor text,
  _ativa boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _folder IS NULL OR NOT public.meta_inbox_folder_can_manage(auth.uid(), _folder) THEN
    RAISE EXCEPTION 'Sem permissão para administrar etiquetas desta caixa';
  END IF;

  IF NULLIF(BTRIM(_nome), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o nome da etiqueta';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.meta_whatsapp_etiquetas WHERE id = _etiqueta) THEN
    RAISE EXCEPTION 'Etiqueta não encontrada';
  END IF;

  INSERT INTO public.meta_inbox_folder_etiquetas
    (folder_id, etiqueta_id, nome, cor, ativa, exclusiva, criado_por, atualizado_em)
  VALUES
    (_folder, _etiqueta, BTRIM(_nome), _cor, COALESCE(_ativa, true), false, auth.uid(), now())
  ON CONFLICT (folder_id, etiqueta_id) DO UPDATE
  SET nome = EXCLUDED.nome,
      cor = EXCLUDED.cor,
      ativa = EXCLUDED.ativa,
      atualizado_em = now();
END;
$$;

REVOKE ALL ON FUNCTION public.meta_etiqueta_caixa_salvar(uuid, uuid, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.meta_etiqueta_caixa_salvar(uuid, uuid, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.meta_etiqueta_caixa_salvar(uuid, uuid, text, text, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.meta_etiqueta_caixa_criar(
  _folder uuid,
  _nome text,
  _cor text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF _folder IS NULL OR NOT public.meta_inbox_folder_can_manage(auth.uid(), _folder) THEN
    RAISE EXCEPTION 'Sem permissão para administrar etiquetas desta caixa';
  END IF;

  IF NULLIF(BTRIM(_nome), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o nome da etiqueta';
  END IF;

  INSERT INTO public.meta_whatsapp_etiquetas (user_id, nome, cor)
  VALUES (auth.uid(), BTRIM(_nome), _cor)
  RETURNING id INTO v_id;

  INSERT INTO public.meta_inbox_folder_etiquetas
    (folder_id, etiqueta_id, nome, cor, ativa, exclusiva, criado_por)
  VALUES
    (_folder, v_id, BTRIM(_nome), _cor, true, true, auth.uid());

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.meta_etiqueta_caixa_criar(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.meta_etiqueta_caixa_criar(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.meta_etiqueta_caixa_criar(uuid, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.meta_etiqueta_caixa_remover(_folder uuid, _etiqueta uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _folder IS NULL OR NOT public.meta_inbox_folder_can_manage(auth.uid(), _folder) THEN
    RAISE EXCEPTION 'Sem permissão para administrar etiquetas desta caixa';
  END IF;

  INSERT INTO public.meta_inbox_folder_etiquetas
    (folder_id, etiqueta_id, ativa, exclusiva, criado_por, atualizado_em)
  VALUES
    (_folder, _etiqueta, false, false, auth.uid(), now())
  ON CONFLICT (folder_id, etiqueta_id) DO UPDATE
  SET ativa = false,
      atualizado_em = now();
END;
$$;

REVOKE ALL ON FUNCTION public.meta_etiqueta_caixa_remover(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.meta_etiqueta_caixa_remover(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.meta_etiqueta_caixa_remover(uuid, uuid) TO service_role;