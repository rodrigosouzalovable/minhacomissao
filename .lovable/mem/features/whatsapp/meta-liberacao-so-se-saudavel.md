---
name: Liberação Meta só com número saudável
description: Auto-liberação de bloqueio Meta só devolve o número ao pool se GREEN, sem quarentena e sem restrição (can_send_message BLOCKED/LIMITED)
type: feature
---

Em `check-meta-instance-health`:

- Lê `health_status` do número e da WABA em chamadas Graph separadas (isoladas, para não derrubar o check) e grava em `meta_whatsapp_instances.saude_restricoes`.
- `restritoMeta` = `can_send_message` em BLOCKED/LIMITED/RESTRICTED na raiz ou em qualquer entidade (PHONE_NUMBER, WABA, BUSINESS, APP).
- Auto-liberação de bloqueio (#131031, #100, #131042) só devolve `estado_pool = 'ativo'` quando: CONNECTED, sem ban_info, qualidade GREEN, sem quarentena ativa e sem restrição. Caso contrário limpa a pausa mas marca `estado_pool = 'restrita'`.
- Notificação ramificada: "Bloqueio liberado" (voltou ao pool) vs "Bloqueio liberado — número ainda NÃO liberado para campanhas", com qualidade, restrição, quarentena e previsão de volta.
