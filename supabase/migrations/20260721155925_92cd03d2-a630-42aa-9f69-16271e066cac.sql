
CREATE OR REPLACE FUNCTION public.set_tenant_id_from_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_tenant uuid;
  v_row jsonb;
  v_val text;
BEGIN
  -- 1) tenant_id explícito vence tudo
  IF NEW.tenant_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_row := to_jsonb(NEW);

  -- 2) Usuário autenticado com membership não-master
  IF v_uid IS NOT NULL THEN
    SELECT tenant_id INTO v_tenant
    FROM public.tenant_members
    WHERE user_id = v_uid
      AND tenant_id <> public.master_tenant_id()
    ORDER BY tenant_id
    LIMIT 1;
    IF v_tenant IS NOT NULL THEN
      NEW.tenant_id := v_tenant;
      RETURN NEW;
    END IF;
  END IF;

  -- 3) Deriva por instancia_id
  v_val := v_row->>'instancia_id';
  IF v_val IS NOT NULL AND v_val <> '' THEN
    SELECT tenant_id INTO v_tenant
    FROM public.meta_whatsapp_instances
    WHERE id = v_val::uuid
    LIMIT 1;
    IF v_tenant IS NOT NULL THEN
      NEW.tenant_id := v_tenant;
      RETURN NEW;
    END IF;
  END IF;

  -- 4) Deriva por job_id (envio_meta_job_item)
  v_val := v_row->>'job_id';
  IF v_val IS NOT NULL AND v_val <> '' THEN
    SELECT tenant_id INTO v_tenant
    FROM public.envio_meta_job
    WHERE id = v_val::uuid
    LIMIT 1;
    IF v_tenant IS NOT NULL THEN
      NEW.tenant_id := v_tenant;
      RETURN NEW;
    END IF;
  END IF;

  -- 5) Deriva por contato_id (etiquetas)
  v_val := v_row->>'contato_id';
  IF v_val IS NOT NULL AND v_val <> '' THEN
    SELECT tenant_id INTO v_tenant
    FROM public.meta_whatsapp_contatos
    WHERE id = v_val::uuid
    LIMIT 1;
    IF v_tenant IS NOT NULL THEN
      NEW.tenant_id := v_tenant;
      RETURN NEW;
    END IF;
  END IF;

  -- 6) Deriva por user_id do registro (pega primeiro membership não-master do dono)
  v_val := v_row->>'user_id';
  IF v_val IS NOT NULL AND v_val <> '' THEN
    SELECT tenant_id INTO v_tenant
    FROM public.tenant_members
    WHERE user_id = v_val::uuid
      AND tenant_id <> public.master_tenant_id()
    ORDER BY tenant_id
    LIMIT 1;
    IF v_tenant IS NOT NULL THEN
      NEW.tenant_id := v_tenant;
      RETURN NEW;
    END IF;
  END IF;

  -- 7) Fallback: master
  NEW.tenant_id := public.master_tenant_id();
  RETURN NEW;
END;
$function$;
