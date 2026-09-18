CREATE OR REPLACE FUNCTION public.ponto_exigencia_ativa()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT CASE
        WHEN jsonb_typeof(value -> 'ativo') = 'boolean' THEN (value ->> 'ativo')::boolean
        ELSE true
      END
      FROM public.system_settings
      WHERE key = 'ponto_exigencia_global'
    ),
    true
  );
$$;

CREATE OR REPLACE FUNCTION public.definir_ponto_exigencia(p_ativo boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar a exigência de ponto.';
  END IF;

  INSERT INTO public.system_settings (key, value, updated_at, updated_by)
  VALUES (
    'ponto_exigencia_global',
    jsonb_build_object('ativo', p_ativo),
    now(),
    auth.uid()
  )
  ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      updated_at = EXCLUDED.updated_at,
      updated_by = EXCLUDED.updated_by;

  RETURN p_ativo;
END;
$$;

REVOKE ALL ON FUNCTION public.ponto_exigencia_ativa() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.definir_ponto_exigencia(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ponto_exigencia_ativa() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.definir_ponto_exigencia(boolean) TO authenticated, service_role;