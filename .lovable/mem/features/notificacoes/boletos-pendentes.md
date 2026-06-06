---
name: Notificações boletos pendentes
description: Aba /admin/notificacoes envia lembretes WA ao operador 14h D-1 e 09h D0 quando acordo não tem boleto_enviado=true
type: feature
---
- Tabelas: notificacoes_config (instancia_id), notificacoes_operador_telefone (user_id→telefone), notificacoes_envios_log (UNIQUE pagamento_id+tipo+data_ref).
- Edge function: notificar-boletos-pendentes (tipo D-1 | D0, dryRun). Domingo é skip.
- Cron: 17 UTC (14h BRT) → D-1; 12 UTC (09h BRT) → D0.
- Envia via send-whatsapp usando instância configurada. Delay random 2-6s entre envios.
- Mensagem só p/ parcelas pendentes de acordos ativos com boleto_enviado=false.
