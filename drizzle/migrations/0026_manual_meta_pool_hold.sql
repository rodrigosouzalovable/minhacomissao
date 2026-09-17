ALTER TABLE public.meta_whatsapp_instances
  ADD COLUMN IF NOT EXISTS pool_fora_manual boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pool_fora_manual_em timestamptz,
  ADD COLUMN IF NOT EXISTS pool_fora_manual_por uuid REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_meta_instances_pool_fora_manual
  ON public.meta_whatsapp_instances (pool_fora_manual)
  WHERE pool_fora_manual = true;

CREATE OR REPLACE FUNCTION public.retirar_meta_instancia_pool_manual(p_instancia_id uuid)
RETURNS public.meta_whatsapp_instances
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_result public.meta_whatsapp_instances;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem retirar instâncias do pool';
  END IF;

  UPDATE public.meta_whatsapp_instances
  SET pool_fora_manual = true,
      pool_fora_manual_em = now(),
      pool_fora_manual_por = v_uid,
      estado_pool = 'fora_manual'
  WHERE id = p_instancia_id
    AND ativo = true
  RETURNING * INTO v_result;

  IF v_result.id IS NULL THEN
    RAISE EXCEPTION 'Instância ativa não encontrada';
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.retirar_meta_instancia_pool_manual(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.retirar_meta_instancia_pool_manual(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.retirar_meta_instancia_pool_manual(uuid) TO service_role;