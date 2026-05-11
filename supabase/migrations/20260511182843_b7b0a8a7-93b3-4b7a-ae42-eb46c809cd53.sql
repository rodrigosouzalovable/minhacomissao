UPDATE whatsapp_aquecimento_status_interacoes
SET executado_em=NULL, sucesso=NULL, erro=NULL, agendado_para=now()
WHERE status_log_id='c97ba772-5e2e-49da-93b3-eb38eb496e1a' AND tipo='reacao';