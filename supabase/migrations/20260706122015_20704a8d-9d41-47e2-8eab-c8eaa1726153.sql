UPDATE public.meta_whatsapp_instances
SET estado_pool = 'ativo',
    fase_rampup = 'fase1',
    data_ativacao_api = COALESCE(data_ativacao_api, now()),
    pausa_automatica_ate = NULL
WHERE ativo = true;