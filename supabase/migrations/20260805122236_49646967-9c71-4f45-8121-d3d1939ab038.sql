CREATE OR REPLACE FUNCTION public.meta_provisionar_atendentes_fila(_folder uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cores text[] := ARRAY['#25D366','#FF6B6B','#4ECDC4','#FFD93D','#6C5CE7','#FF8A5C','#EA4C89','#00B4D8'];
  r RECORD;
  v_etq uuid;
  v_count integer := 0;
  v_ordem integer;
BEGIN
  FOR r IN
    SELECT p.id AS user_id, btrim(p.nome) AS nome
    FROM public.profiles p
    WHERE COALESCE(p.ativo, true) = true
      AND btrim(COALESCE(p.nome,'')) <> ''
      AND (
        (_folder IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.meta_inbox_folder_members m
          WHERE m.folder_id = _folder AND m.user_id = p.id))
        OR
        (_folder IS NULL AND EXISTS (
          SELECT 1 FROM public.meta_inbox_default_members d WHERE d.user_id = p.id))
      )
  LOOP
    SELECT e.id INTO v_etq
    FROM public.meta_whatsapp_etiquetas e
    WHERE lower(btrim(e.nome)) = lower('Atendente: ' || r.nome)
    LIMIT 1;

    IF v_etq IS NULL THEN
      INSERT INTO public.meta_whatsapp_etiquetas (user_id, nome, cor)
      VALUES (r.user_id, 'Atendente: ' || r.nome,
              v_cores[1 + (abs(hashtext(r.nome)) % array_length(v_cores,1))])
      RETURNING id INTO v_etq;
      v_count := v_count + 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.meta_atendimento_fila f WHERE f.etiqueta_id = v_etq) THEN
      SELECT COALESCE(MAX(ordem),0) + 1 INTO v_ordem FROM public.meta_atendimento_fila;
      INSERT INTO public.meta_atendimento_fila (etiqueta_id, user_id, ordem, ativo)
      VALUES (v_etq, r.user_id, v_ordem, true);
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.meta_provisionar_atendentes_fila(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.meta_provisionar_atendentes_fila(uuid) TO authenticated;

-- Backfill de todos os vínculos existentes (caixa padrão + cada caixa)
SELECT public.meta_provisionar_atendentes_fila(NULL);
SELECT public.meta_provisionar_atendentes_fila(f.id) FROM public.meta_inbox_folders f;