---
name: IAGO — negociação nunca é "número errado"
description: Frases de data/condição ("hoje não porque não é o quinto dia útil") não disparam encerramento por identidade; em etapa de negociação IAGO escala ao humano
type: feature
---

- `ehContextoNegociacao` (`_shared/iago.ts`): detecta pagamento/parcela/data/dia da semana/dia útil/salário. Quando verdadeiro, `ehNumeroErrado` retorna false.
- A regra `não é o/a <palavra>` só vale quando a palavra seguinte é pessoa; palavras de contexto (dia, quinto, valor, data, vencimento, salário…) são ignoradas.
- `iago-atendimento`: em etapa `escolha_feita`, `aguardando_data`, `proposta` ou com `proposta_enviada`/`opcao_escolhida` no contexto, identidade negada **não encerra** — força `escalar` para o atendente humano.
- `respostaPagamentoHoje`: negação tem prioridade ("hoje não porque…" = nao); proposta de outro dia ("consegue por para…", "dia N") = nao.
- `classificarDataPagamento`: "dia N" / data numérica / mês por nome têm prioridade sobre "hoje" e sobre o dia da semana ("terça feira dia 08" → dia 08).
