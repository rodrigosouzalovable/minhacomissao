# IAGO precisa saber que dia é hoje e entender "segunda", "sexta", "semana que vem"

## O que está errado (verificado no código)

O interpretador de data do IAGO entende "hoje", "amanhã", "dia 20", "20/08", "20 de agosto", "semana que vem" e "mês que vem" — mas **não entende dias da semana**. Como "segunda" (e "segunda que vem") não é reconhecido, a resposta cai como "indefinido" e ele repergunta "Que dia você consegue realizar o pagamento?".

Além disso, o prompt enviado à IA **não informa a data atual nem o dia da semana**, então ela também não consegue converter "segunda" em uma data.

## Correções

1. **IAGO passa a saber a data de hoje**: o prompt ganha uma linha fixa com a data completa e o dia da semana no fuso de São Paulo (ex.: "HOJE é sexta-feira, 14/08/2026"), mais a data de cada próximo dia da semana (segunda a domingo), para que a IA nunca calcule dia errado.

2. **Entender dias da semana**: o interpretador passa a reconhecer "segunda", "segunda-feira", "seg", "terça", "quarta", "quinta", "sexta", "sábado", "domingo", com as variações "que vem", "próxima", "hoje mesmo" e "essa/esta". Sempre resolve para a **próxima ocorrência futura** daquele dia. Se a data cair dentro do mês atual → confirma e chama o atendente; se cair no mês seguinte → escala com o motivo "data fora do mês atual" (regra atual mantida).

3. **Resposta combinada numa só frase**: quando o cliente responde "não, consigo segunda", o IAGO extrai a data da mesma mensagem em vez de só ver o "não" e reperguntar. A repergunta só acontece se realmente não houver nenhuma data na frase.

4. **Confirmação com a data legível**: ao confirmar, ele responde com o dia entendido ("Combinado, segunda-feira, dia 17/08"), para o cliente conseguir corrigir se for outro dia. O aviso ao atendente também passa a mostrar essa data.

## Detalhes técnicos

- `supabase/functions/_shared/iago.ts`:
  - `classificarDataPagamento`: novo bloco de dias da semana (mapa nome→índice, com abreviações e acentos normalizados) resolvendo para a próxima ocorrência (hoje conta apenas com "hoje"/"hoje mesmo"); "próxima/que vem" adiciona uma semana quando o dia já passou na semana corrente. `label` passa a incluir o nome do dia + `dd/mm`.
  - Novo helper `contextoDataHoje()` retornando a data de hoje, o dia da semana e as datas dos próximos 7 dias em texto, para injetar no prompt.
- `supabase/functions/iago-atendimento/index.ts`:
  - `gerarResposta`: incluir `contextoDataHoje()` no prompt e instruir que `data_pagamento` deve ser devolvido preferencialmente em `YYYY-MM-DD` já resolvido.
  - Fluxo de etapa: quando `pagamento_hoje === 'nao'`, tentar `classificarDataPagamento` na própria mensagem do cliente antes de ir para `aguardando_data`; só reperguntar se o resultado for `indefinido`.
  - Mensagens de fallback e `avisarEmergencia` usando o `label` da data resolvida.

Sem novas tabelas, sem cron novo, sem impacto de custo (mesma chamada de IA por mensagem).
