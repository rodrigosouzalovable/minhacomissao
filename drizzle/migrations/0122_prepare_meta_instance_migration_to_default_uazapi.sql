ALTER TABLE public.meta_whatsapp_instances
  ADD COLUMN IF NOT EXISTS folder_padrao_fixo boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.meta_whatsapp_instances.folder_padrao_fixo IS
  'Preserva a caixa definida explicitamente para espelhos UAZAPI durante sincronizações.';

CREATE OR REPLACE FUNCTION public.sync_uazapi_mirror_instance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_folder uuid;
  v_tenant uuid;
  v_nome text;
  v_existing uuid;
  v_folder_fixo boolean;
BEGIN
  SELECT id INTO v_folder FROM public.meta_inbox_folders WHERE upper(nome) = 'AQUECIMENTO' LIMIT 1;
  IF v_folder IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT tenant_id INTO v_tenant FROM public.meta_whatsapp_instances WHERE provider = 'meta' LIMIT 1;
  IF v_tenant IS NULL THEN
    v_tenant := public.master_tenant_id();
  END IF;

  v_nome := COALESCE(NULLIF(TRIM(NEW.nome), ''), NEW.whatsapp_profile_name, NEW.telefone, 'Instância UAZAPI');

  SELECT id, folder_padrao_fixo
    INTO v_existing, v_folder_fixo
    FROM public.meta_whatsapp_instances
   WHERE uazapi_instance_id = NEW.id
   LIMIT 1;

  IF v_existing IS NULL THEN
    INSERT INTO public.meta_whatsapp_instances (
      user_id, tenant_id, nome, display_phone, provider, uazapi_instance_id,
      folder_padrao_id, folder_padrao_fixo, ativo
    ) VALUES (
      NEW.user_id, v_tenant, v_nome, NEW.telefone, 'uazapi', NEW.id,
      v_folder, false, NEW.ativo
    );
  ELSE
    UPDATE public.meta_whatsapp_instances
       SET nome = v_nome,
           display_phone = COALESCE(NEW.telefone, display_phone),
           ativo = NEW.ativo,
           folder_padrao_id = CASE
             WHEN COALESCE(v_folder_fixo, false) THEN folder_padrao_id
             ELSE COALESCE(folder_padrao_id, v_folder)
           END,
           atualizado_em = now()
     WHERE id = v_existing;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.migrar_instancia_meta_para_uazapi_padrao(
  _instancia_meta_id uuid,
  _uazapi_instance_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_meta public.meta_whatsapp_instances%ROWTYPE;
  v_uazapi public.user_whatsapp_instances%ROWTYPE;
  v_espelho_id uuid;
  v_espelho_contatos bigint;
  v_espelho_mensagens bigint;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem migrar uma instância para UAZAPI';
  END IF;

  SELECT * INTO v_meta
    FROM public.meta_whatsapp_instances
   WHERE id = _instancia_meta_id
   FOR UPDATE;
  IF NOT FOUND OR v_meta.provider <> 'meta' THEN
    RAISE EXCEPTION 'Instância oficial de origem inválida';
  END IF;

  SELECT * INTO v_uazapi
    FROM public.user_whatsapp_instances
   WHERE id = _uazapi_instance_id
   FOR UPDATE;
  IF NOT FOUND OR NOT v_uazapi.ativo THEN
    RAISE EXCEPTION 'A conexão UAZAPI informada não existe ou não está ativa';
  END IF;

  IF right(regexp_replace(COALESCE(v_meta.display_phone, ''), '\D', '', 'g'), 8)
     IS DISTINCT FROM
     right(regexp_replace(COALESCE(v_uazapi.telefone, ''), '\D', '', 'g'), 8) THEN
    RAISE EXCEPTION 'O telefone da conexão UAZAPI não corresponde à instância oficial';
  END IF;

  SELECT id INTO v_espelho_id
    FROM public.meta_whatsapp_instances
   WHERE uazapi_instance_id = _uazapi_instance_id
     AND id <> _instancia_meta_id
   FOR UPDATE;

  IF v_espelho_id IS NOT NULL THEN
    SELECT count(*) INTO v_espelho_contatos
      FROM public.meta_whatsapp_contatos WHERE instancia_id = v_espelho_id;
    SELECT count(*) INTO v_espelho_mensagens
      FROM public.meta_whatsapp_mensagens WHERE instancia_id = v_espelho_id;
    IF v_espelho_contatos > 0 OR v_espelho_mensagens > 0 THEN
      RAISE EXCEPTION 'A conexão UAZAPI já recebeu mensagens; migração interrompida para evitar duplicidade';
    END IF;
    DELETE FROM public.meta_whatsapp_instances WHERE id = v_espelho_id;
  END IF;

  UPDATE public.meta_whatsapp_instances
     SET provider = 'uazapi',
         uazapi_instance_id = _uazapi_instance_id,
         folder_padrao_id = NULL,
         folder_padrao_fixo = true,
         nome = COALESCE(NULLIF(TRIM(v_uazapi.nome), ''), nome),
         display_phone = COALESCE(v_uazapi.telefone, display_phone),
         ativo = true,
         atualizado_em = now()
   WHERE id = _instancia_meta_id;

  UPDATE public.meta_whatsapp_contatos
     SET folder_id = NULL,
         atualizado_em = now()
   WHERE instancia_id = _instancia_meta_id;

  RETURN jsonb_build_object(
    'ok', true,
    'instancia_id', _instancia_meta_id,
    'uazapi_instance_id', _uazapi_instance_id,
    'conversas_preservadas', (SELECT count(*) FROM public.meta_whatsapp_contatos WHERE instancia_id = _instancia_meta_id),
    'mensagens_preservadas', (SELECT count(*) FROM public.meta_whatsapp_mensagens WHERE instancia_id = _instancia_meta_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.migrar_instancia_meta_para_uazapi_padrao(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.migrar_instancia_meta_para_uazapi_padrao(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.migrar_instancia_meta_para_uazapi_padrao(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.migrar_instancia_meta_para_uazapi_padrao(uuid, uuid) TO service_role;