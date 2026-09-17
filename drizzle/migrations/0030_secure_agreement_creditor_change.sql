CREATE TABLE public.acordo_credor_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acordo_id uuid NOT NULL REFERENCES public.acordos(id) ON DELETE CASCADE,
  credor_anterior text NOT NULL CHECK (credor_anterior IN ('ume_novo_mundo', 'mundo_da_moda')),
  credor_novo text NOT NULL CHECK (credor_novo IN ('ume_novo_mundo', 'mundo_da_moda')),
  alterado_por uuid NOT NULL,
  alterado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.acordo_credor_auditoria TO authenticated;
GRANT ALL ON public.acordo_credor_auditoria TO service_role;

ALTER TABLE public.acordo_credor_auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Rodrigo pode consultar auditoria de credores"
ON public.acordo_credor_auditoria
FOR SELECT
TO authenticated
USING (auth.uid() = 'ee649720-b8ce-47a2-859e-100a3a9ae6bb'::uuid);

CREATE OR REPLACE FUNCTION public.pode_alterar_credor_acordo()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() = 'ee649720-b8ce-47a2-859e-100a3a9ae6bb'::uuid
     AND public.has_role(auth.uid(), 'admin'::public.app_role);
$$;

REVOKE ALL ON FUNCTION public.pode_alterar_credor_acordo() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pode_alterar_credor_acordo() TO authenticated;

CREATE OR REPLACE FUNCTION public.proteger_credor_acordo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.empresa IS DISTINCT FROM OLD.empresa
     AND COALESCE(current_setting('app.alteracao_credor_autorizada', true), '') <> 'sim' THEN
    RAISE EXCEPTION 'O credor somente pode ser alterado pela operação exclusiva autorizada.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER proteger_credor_acordo_trigger
BEFORE UPDATE OF empresa ON public.acordos
FOR EACH ROW
EXECUTE FUNCTION public.proteger_credor_acordo();

CREATE OR REPLACE FUNCTION public.alterar_credor_acordo(
  p_acordo_id uuid,
  p_novo_credor text
)
RETURNS public.acordos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acordo public.acordos%ROWTYPE;
  v_anterior text;
BEGIN
  IF NOT public.pode_alterar_credor_acordo() THEN
    RAISE EXCEPTION 'Apenas o acesso autorizado pode alterar o credor.'
      USING ERRCODE = '42501';
  END IF;

  IF p_novo_credor NOT IN ('ume_novo_mundo', 'mundo_da_moda') THEN
    RAISE EXCEPTION 'Credor inválido.' USING ERRCODE = '22023';
  END IF;

  SELECT empresa INTO v_anterior
  FROM public.acordos
  WHERE id = p_acordo_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acordo não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  IF v_anterior = p_novo_credor THEN
    SELECT * INTO v_acordo FROM public.acordos WHERE id = p_acordo_id;
    RETURN v_acordo;
  END IF;

  PERFORM set_config('app.alteracao_credor_autorizada', 'sim', true);

  UPDATE public.acordos
  SET empresa = p_novo_credor,
      atualizado_em = now()
  WHERE id = p_acordo_id
  RETURNING * INTO v_acordo;

  INSERT INTO public.acordo_credor_auditoria (
    acordo_id, credor_anterior, credor_novo, alterado_por
  ) VALUES (
    p_acordo_id, v_anterior, p_novo_credor, auth.uid()
  );

  RETURN v_acordo;
END;
$$;

REVOKE ALL ON FUNCTION public.alterar_credor_acordo(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.alterar_credor_acordo(uuid, text) TO authenticated;