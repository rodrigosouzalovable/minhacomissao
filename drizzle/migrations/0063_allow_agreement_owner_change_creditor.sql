CREATE OR REPLACE FUNCTION public.pode_alterar_credor_acordo(p_acordo_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
     AND (
       (
         auth.uid() = 'ee649720-b8ce-47a2-859e-100a3a9ae6bb'::uuid
         AND public.has_role(auth.uid(), 'admin'::public.app_role)
       )
       OR EXISTS (
         SELECT 1
         FROM public.acordos a
         WHERE a.id = p_acordo_id
           AND a.user_id = auth.uid()
       )
     );
$$;

REVOKE ALL ON FUNCTION public.pode_alterar_credor_acordo(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pode_alterar_credor_acordo(uuid) TO authenticated;

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
  IF NOT public.pode_alterar_credor_acordo(p_acordo_id) THEN
    RAISE EXCEPTION 'Você não pode alterar o credor deste acordo.'
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