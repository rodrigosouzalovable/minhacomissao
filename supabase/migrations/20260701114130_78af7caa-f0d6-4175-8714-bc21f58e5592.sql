UPDATE public.meta_whatsapp_contatos
SET nao_lido = 0,
    atualizado_em = now()
WHERE COALESCE(nao_lido, 0) <> 0;