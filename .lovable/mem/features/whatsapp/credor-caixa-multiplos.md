---
name: Vários credores ativos por caixa
description: Caixa do Inbox Meta pode ter mais de um credor ativo; IAGO resolve o credor pelo cabeçalho da conversa
type: feature
---

Em "Configurar caixa" > "Credor da caixa" é possível manter **vários credores ativos ao mesmo tempo** (o índice único de 1 ativo por caixa foi removido; ativar um não desativa os outros).

Resolução do credor da conversa (`resolverCredorConversa` em `supabase/functions/_shared/iago.ts`, usada por `iago-atendimento` e `iago-followup-tick`):
1. Credor marcado no cabeçalho da conversa (`meta_whatsapp_contatos.credor`: `novo_mundo` / `ume`) sempre prevalece — comparação por nome normalizado com os credores ativos da caixa; se não estiver entre eles, usa o rótulo do cabeçalho.
2. Sem marcação no cabeçalho e apenas um credor ativo → usa esse.
3. Sem marcação e vários ativos → `ambiguo`: o IAGO não afirma credor nenhum, pede CPF para confirmar e escala se necessário.

A consulta da calculadora de desconto UME é acionada quando o credor **resolvido** é UME.
