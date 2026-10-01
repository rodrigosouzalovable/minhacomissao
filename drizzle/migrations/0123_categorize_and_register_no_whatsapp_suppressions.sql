ALTER TABLE public.meta_destinatario_supressao
  ADD COLUMN IF NOT EXISTS categoria text NOT NULL DEFAULT 'supressao';

UPDATE public.meta_destinatario_supressao
SET categoria = CASE
  WHEN motivo LIKE 'blacklist%' THEN 'blacklist'
  ELSE 'supressao'
END
WHERE categoria = 'supressao';

ALTER TABLE public.meta_destinatario_supressao
  ADD CONSTRAINT meta_destinatario_supressao_categoria_check
  CHECK (categoria IN ('blacklist', 'supressao', 'sem_whatsapp')) NOT VALID;

ALTER TABLE public.meta_destinatario_supressao
  VALIDATE CONSTRAINT meta_destinatario_supressao_categoria_check;

CREATE INDEX IF NOT EXISTS idx_meta_destinatario_supressao_categoria
  ON public.meta_destinatario_supressao (categoria, criado_em DESC);

COMMENT ON COLUMN public.meta_destinatario_supressao.categoria IS
  'Categoria operacional: blacklist por solicitação, supressão por falha/regra ou sem_whatsapp confirmado.';

CREATE OR REPLACE FUNCTION public.registrar_sem_whatsapp_verificados(_telefones jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inseridos integer := 0;
  _recebidos integer := 0;
BEGIN
  IF jsonb_typeof(_telefones) <> 'array' THEN
    RAISE EXCEPTION 'Lista de telefones inválida';
  END IF;

  WITH normalizados AS (
    SELECT DISTINCT
      regexp_replace(value, '\D', '', 'g') AS telefone
    FROM jsonb_array_elements_text(_telefones)
  ), validos AS (
    SELECT telefone, right(telefone, 8) AS telefone_sufixo
    FROM normalizados
    WHERE length(telefone) >= 8
  )
  SELECT count(*) INTO _recebidos FROM validos;

  WITH normalizados AS (
    SELECT DISTINCT
      regexp_replace(value, '\D', '', 'g') AS telefone
    FROM jsonb_array_elements_text(_telefones)
  ), validos AS (
    SELECT telefone, right(telefone, 8) AS telefone_sufixo
    FROM normalizados
    WHERE length(telefone) >= 8
  )
  INSERT INTO public.meta_destinatario_supressao (
    telefone_sufixo,
    telefone,
    motivo,
    categoria,
    falhas,
    criado_em,
    atualizado_em
  )
  SELECT
    telefone_sufixo,
    telefone,
    'Sem WhatsApp verificado',
    'sem_whatsapp',
    1,
    now(),
    now()
  FROM validos
  ON CONFLICT (telefone_sufixo) DO NOTHING;

  GET DIAGNOSTICS _inseridos = ROW_COUNT;

  RETURN jsonb_build_object(
    'recebidos', _recebidos,
    'inseridos', _inseridos,
    'ja_existentes', greatest(_recebidos - _inseridos, 0)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.listar_sem_whatsapp_verificados(_sufixos text[])
RETURNS TABLE (telefone_sufixo text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.telefone_sufixo
  FROM public.meta_destinatario_supressao s
  WHERE s.categoria = 'sem_whatsapp'
    AND s.telefone_sufixo = ANY(coalesce(_sufixos, ARRAY[]::text[]));
$$;

REVOKE ALL ON FUNCTION public.registrar_sem_whatsapp_verificados(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_sem_whatsapp_verificados(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_sem_whatsapp_verificados(jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.listar_sem_whatsapp_verificados(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_sem_whatsapp_verificados(text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_sem_whatsapp_verificados(text[]) TO service_role;