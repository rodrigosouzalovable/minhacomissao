CREATE INDEX IF NOT EXISTS idx_wa_contatos_inst_arq_ult ON public.whatsapp_contatos (instancia_id, arquivado, ultima_mensagem_em DESC);
CREATE INDEX IF NOT EXISTS idx_wa_contatos_inst_arq_naolido ON public.whatsapp_contatos (instancia_id, arquivado, nao_lido);
CREATE INDEX IF NOT EXISTS idx_meta_wa_contatos_arq_ult ON public.meta_whatsapp_contatos (arquivado, ultima_mensagem_em DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_pagamentos_status_dtprev ON public.pagamentos (status, data_prevista);
CREATE INDEX IF NOT EXISTS idx_pagamentos_acordo_status ON public.pagamentos (acordo_id, status);