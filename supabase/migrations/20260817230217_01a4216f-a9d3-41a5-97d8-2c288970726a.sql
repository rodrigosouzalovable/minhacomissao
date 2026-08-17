-- 1) Colunas de suporte a instâncias espelho (UAZAPI / não oficiais)
ALTER TABLE public.meta_whatsapp_instances
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'meta',
  ADD COLUMN IF NOT EXISTS uazapi_instance_id uuid REFERENCES public.user_whatsapp_instances(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS folder_padrao_id uuid REFERENCES public.meta_inbox_folders(id) ON DELETE SET NULL;

ALTER TABLE public.meta_whatsapp_instances
  ALTER COLUMN access_token DROP NOT NULL,
  ALTER COLUMN phone_number_id DROP NOT NULL,
  ALTER COLUMN waba_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS meta_whatsapp_instances_uazapi_uniq
  ON public.meta_whatsapp_instances(uazapi_instance_id);

-- 2) Sincronização automática: cada instância UAZAPI ganha um espelho na caixa AQUECIMENTO
CREATE OR REPLACE FUNCTION public.sync_uazapi_mirror_instance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_folder uuid;
  v_tenant uuid;
  v_nome text;
  v_existing uuid;
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

  SELECT id INTO v_existing FROM public.meta_whatsapp_instances WHERE uazapi_instance_id = NEW.id LIMIT 1;

  IF v_existing IS NULL THEN
    INSERT INTO public.meta_whatsapp_instances (
      user_id, tenant_id, nome, display_phone, provider, uazapi_instance_id,
      folder_padrao_id, ativo
    ) VALUES (
      NEW.user_id, v_tenant, v_nome, NEW.telefone, 'uazapi', NEW.id, v_folder, NEW.ativo
    );
  ELSE
    UPDATE public.meta_whatsapp_instances
       SET nome = v_nome,
           display_phone = COALESCE(NEW.telefone, display_phone),
           ativo = NEW.ativo,
           folder_padrao_id = COALESCE(folder_padrao_id, v_folder),
           atualizado_em = now()
     WHERE id = v_existing;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_uazapi_mirror_instance ON public.user_whatsapp_instances;
CREATE TRIGGER trg_sync_uazapi_mirror_instance
AFTER INSERT OR UPDATE OF nome, telefone, ativo, whatsapp_profile_name ON public.user_whatsapp_instances
FOR EACH ROW EXECUTE FUNCTION public.sync_uazapi_mirror_instance();

-- 3) Backfill das instâncias já conectadas
UPDATE public.user_whatsapp_instances SET nome = nome;