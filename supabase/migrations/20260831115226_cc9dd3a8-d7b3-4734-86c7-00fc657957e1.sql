ALTER TABLE public.meta_envio_pool_config
  ADD COLUMN IF NOT EXISTS liberar_qualidade_global boolean NOT NULL DEFAULT false;

UPDATE public.meta_envio_pool_config SET liberar_qualidade_global = true WHERE id = 1;

UPDATE public.meta_whatsapp_instances
SET quarentena_ate = NULL,
    quarentena_motivo = NULL,
    recuperacao_ativa = false,
    pausa_automatica_ate = CASE WHEN COALESCE(pausa_automatica_motivo,'') ILIKE 'quality=%' THEN NULL ELSE pausa_automatica_ate END,
    pausa_automatica_motivo = CASE WHEN COALESCE(pausa_automatica_motivo,'') ILIKE 'quality=%' THEN NULL ELSE pausa_automatica_motivo END,
    estado_pool = CASE WHEN estado_pool IN ('pausado','restrita') THEN 'ativo' ELSE estado_pool END
WHERE quarentena_ate > now()
   OR recuperacao_ativa = true
   OR (estado_pool IN ('pausado','restrita') AND COALESCE(saude_quality,'') IN ('RED','YELLOW'));