---
name: IAGO — confirmação da data de pagamento
description: Após a escolha da forma de pagamento, IAGO pergunta se o cliente paga hoje, depois que dia; entende dias da semana e datas ISO; data fora do mês atual escala para humano
type: feature
---

Fluxo do IAGO depois que o cliente escolhe à vista ou parcelamento (etapas em `iago_conversa_estado.etapa` + `contexto`):

1. `escolha_feita` — confirma a escolha e pergunta "Você consegue realizar o pagamento hoje?" (não fala de especialista/transferência ainda).
2. Resposta "sim/hoje" → escala para humano com opção + "hoje".
3. Resposta "não" sem data → `aguardando_data`, pergunta "Que dia você consegue realizar o pagamento?".
4. Data dentro do mês atual → confirma e escala. Data fora do mês ("mês que vem", dia já passado no mês) → escala com motivo "data FORA do mês atual", sem prometer prazo.
5. Resposta vaga após a repergunta (`contexto.reperguntou_data`) → escala com motivo "não definiu a data".

Data: o prompt sempre recebe `contextoDataHoje()` (data de hoje + dia da semana + os próximos 7 dias em ISO, fuso SP), e a IA devolve `data_pagamento` já resolvido em `YYYY-MM-DD`.
`classificarDataPagamento` (`_shared/iago.ts`) entende ISO, "hoje/amanhã/depois de amanhã", **dias da semana** (segunda…domingo, abreviações, "que vem/próxima" = +1 semana), "semana que vem", "mês que vem", "20/08", "20 de agosto", "dia 20"; ignora ordinais ("segunda parcela"). `label` sai como "segunda-feira, dia 17/08".
Resposta combinada ("não, consigo segunda") extrai a data da própria frase — sem repergunta.

`contexto`: `opcao_escolhida`, `data_pagamento`, `reperguntou_data`. Aviso ao humano inclui opção escolhida e data.
Helpers: `classificarDataPagamento`, `contextoDataHoje`, `detectarEscolha`, `respostaPagamentoHoje`.
