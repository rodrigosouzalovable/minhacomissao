CREATE OR REPLACE FUNCTION public.proteger_modo_teste_meta_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.instancia_teste_aquecimento = true
     AND auth.uid() IS NOT NULL
     AND NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'Somente administradores podem ativar o modo de teste Meta';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.instancia_teste_aquecimento = true THEN
      NEW.teste_aquecimento_ativado_em := now();
      NEW.aquecimento_meta_ativo := false;
      NEW.recuperacao_ativa := false;
      NEW.pool_fora_manual := true;
      NEW.estado_pool := 'fora';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.instancia_teste_aquecimento IS DISTINCT FROM OLD.instancia_teste_aquecimento
     AND auth.uid() IS NOT NULL
     AND NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'Somente administradores podem alterar o modo de teste Meta';
  END IF;

  IF NEW.instancia_teste_aquecimento = true AND OLD.instancia_teste_aquecimento IS DISTINCT FROM true THEN
    NEW.teste_aquecimento_ativado_em := now();
    NEW.aquecimento_meta_ativo := false;
    NEW.recuperacao_ativa := false;
    NEW.pool_fora_manual := true;
    NEW.estado_pool := 'fora';
  ELSIF NEW.instancia_teste_aquecimento = false AND OLD.instancia_teste_aquecimento IS DISTINCT FROM false THEN
    NEW.teste_aquecimento_ativado_em := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proteger_modo_teste_meta_admin ON public.meta_whatsapp_instances;
CREATE TRIGGER trg_proteger_modo_teste_meta_admin
BEFORE INSERT OR UPDATE OF instancia_teste_aquecimento ON public.meta_whatsapp_instances
FOR EACH ROW EXECUTE FUNCTION public.proteger_modo_teste_meta_admin();