-- Função que resolve o tenant_id do usuário atual
CREATE OR REPLACE FUNCTION public.set_tenant_id_from_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_tenant uuid;
BEGIN
  -- Se já veio tenant_id, respeita
  IF NEW.tenant_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF v_uid IS NULL THEN
    NEW.tenant_id := public.master_tenant_id();
    RETURN NEW;
  END IF;

  -- Pega primeiro tenant do usuário (não-master), se existir
  SELECT tenant_id INTO v_tenant
  FROM public.tenant_members
  WHERE user_id = v_uid
    AND tenant_id <> public.master_tenant_id()
  ORDER BY tenant_id
  LIMIT 1;

  IF v_tenant IS NULL THEN
    v_tenant := public.master_tenant_id();
  END IF;

  NEW.tenant_id := v_tenant;
  RETURN NEW;
END;
$$;

-- Aplica trigger BEFORE INSERT nas tabelas Meta com tenant_id
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'envio_meta_job','envio_meta_job_item','meta_aquecimento_pares',
    'meta_atendimento_estado','meta_atendimento_fila','meta_billing_alerts',
    'meta_billing_guardrail','meta_billing_meta_mensal','meta_billing_relatorio_config',
    'meta_billing_snapshot','meta_business_managers','meta_campanha_agendada',
    'meta_campanha_item','meta_envio_pool_config','meta_envios_fila',
    'meta_envios_meta_diaria','meta_instance_daily_metrics','meta_instance_pagamentos',
    'meta_lembrete_config','meta_lembrete_log','meta_templates_instancia',
    'meta_templates_lote_log','meta_templates_mestre','meta_whatsapp_config',
    'meta_whatsapp_contato_etiquetas','meta_whatsapp_contatos','meta_whatsapp_envios_log',
    'meta_whatsapp_etiquetas','meta_whatsapp_instances','meta_whatsapp_mensagens',
    'meta_whatsapp_mensagens_rapidas','meta_whatsapp_templates'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_set_tenant_id ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_set_tenant_id BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_from_membership()',
      t
    );
  END LOOP;
END $$;