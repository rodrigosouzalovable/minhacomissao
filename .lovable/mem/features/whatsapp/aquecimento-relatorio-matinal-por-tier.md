---
name: Relatório matinal e metas de aquecimento por tier
description: Plano das 07h informa metas por número no WhatsApp admin; tier 250 usa 25/dia e tier 2.000 usa até 450/dia
type: feature
---

- Após o planejamento diário das 07h BRT, enviar ao WhatsApp administrativo o total programado e a meta de cada número, identificando BM, tier e mix Google Maps/UAZAPI.
- Listar também números selecionados sem plano e o motivo específico.
- Tier 250: meta de 25 destinatários únicos/dia.
- Tier de 2.000 até abaixo de 10.000: meta intensiva de até 450 destinatários únicos/dia.
- GREEN, UNKNOWN e nome em análise podem aquecer; manter bloqueios reais, YELLOW/RED, quarentena, recuperação, credenciais incompletas e ausência de template UTILITY para leads.
- O resumo reutiliza o planejamento existente, sem novo cron, e possui idempotência diária.