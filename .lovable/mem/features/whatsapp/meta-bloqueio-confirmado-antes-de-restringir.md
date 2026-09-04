---
name: Bloqueio Meta confirmado antes de restringir
description: Antes de tirar número do pool por #131031/#131042/#131049/#131050/#368/#130429, o sistema confirma health_status na Graph; pausa curta de 1h
type: feature
---

- `_shared/meta-conta-bloqueada.ts` expõe `metaConfirmaBloqueio(inst)` → lê `GET /{phone_number_id}?fields=health_status,status`; retorna `true` (BLOCKED/LIMITED/RESTRICTED em qualquer entidade ou status BANNED), `false` (tudo AVAILABLE) ou `null` (não confirmou → mantém comportamento antigo).
- `tratarContaBloqueada` retorna boolean: se a Meta diz liberado, NÃO restringe — o contato falha e é reenfileirado, a instância segue no rodízio.
- Mesma confirmação em `meta-whatsapp-webhook` (status `failed`) e `send-whatsapp-meta` (bloco `isRestricted`), só para a família de códigos de bloqueio de conta.
- Pausa automática para bloqueio de conta caiu de 24h para **1h**, porque `check-meta-instance-health` revalida de hora em hora e libera sozinho quando a Graph volta saudável.
