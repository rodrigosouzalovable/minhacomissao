---
name: Notificações com remetente único + BM
description: Avisos do sistema saem sempre por uma única instância UAZAPI fixa (admin_notificacoes_config.instancia_notificacao_id) com failover, e mensagens de instância Meta mostram a BM vinculada
type: feature
---
- `admin_notificacoes_config.instancia_notificacao_id` guarda o remetente FIXO das notificações.
- `_shared/notificar-admin.ts`: usa esse remetente se estiver conectado (sem verificar as outras). Só se ele cair verifica todas as ativas, envia por outra conectada e grava a nova como remetente fixo. Nunca round-robin.
- `_shared/rotulo-instancia.ts` exporta `linhaBmInstancia(supabase, inst)` → `BM: *<nome>*` (resolve por `meta_bm_id`, fallback `business_id`, senão "não vinculada").
- Toda notificação que cita instância Meta mostra a BM logo abaixo do número (health, #131031/#131042, #100).
