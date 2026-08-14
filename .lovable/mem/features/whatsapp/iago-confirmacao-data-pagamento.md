---
name: IAGO — confirmação da data de pagamento
description: Após a escolha da forma de pagamento, IAGO pergunta se o cliente paga hoje, depois que dia; data fora do mês atual escala para humano
type: feature
---

Fluxo do IAGO depois que o cliente escolhe à vista ou parcelamento (etapas em `iago_conversa_estado.etapa` + `contexto`):

1. `escolha_feita` — confirma a escolha e pergunta "Você consegue realizar o pagamento hoje?" (não fala de especialista/transferência ainda).
2. Resposta "sim/hoje" → escala para humano com opção + "hoje".
3. Resposta "não" → `aguardando_data`, pergunta "Que dia você consegue realizar o pagamento?".
4. Data dentro do mês atual → confirma e escala. Data fora do mês ("mês que vem", dia já passado no mês) → escala com motivo "data FORA do mês atual", sem prometer prazo.
5. Resposta vaga após a repergunta (`contexto.reperguntou_data`) → escala com motivo "não definiu a data".

`contexto`: `opcao_escolhida`, `data_pagamento`, `reperguntou_data`. Aviso ao humano inclui opção escolhida e data.
Helpers em `_shared/iago.ts`: `classificarDataPagamento` (hoje / dentro_do_mes / fora_do_mes / indefinido, fuso SP), `detectarEscolha`, `respostaPagamentoHoje`. A IA também devolve `escolha`, `pagamento_hoje`, `data_pagamento` no JSON, com fallback por palavra-chave.
