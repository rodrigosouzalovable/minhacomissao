---
name: Notificações pessoais por UAZAPI + BM
description: Avisos pessoais usam rodízio entre instâncias UAZAPI escolhidas, com fila global e intervalo aleatório de 30–60 segundos; mensagens Meta mostram a BM
type: feature
---
- Administradores podem habilitar várias instâncias UAZAPI nos próprios cards para enviar notificações pessoais.
- Os avisos pessoais usam rodízio entre as selecionadas que estiverem ativas e conectadas; se nenhuma estiver disponível, usam outra ativa e conectada como contingência.
- Uma fila global serializa os avisos e sorteia individualmente 30–60 segundos entre mensagens, inclusive para avisos do IAGO.
- `_shared/rotulo-instancia.ts` exporta `linhaBmInstancia(supabase, inst)` → `BM: *<nome>*` (resolve por `meta_bm_id`, fallback `business_id`, senão "não vinculada").
- Toda notificação que cita instância Meta mostra a BM logo abaixo do número (health, #131031/#131042, #100).
