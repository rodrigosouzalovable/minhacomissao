Adicionar "Acumulado do mês" no relatório do WhatsApp

1. Logo abaixo de "💵 Valor em acordos", nova linha: "📆 Acumulado do mês: *R$ X*" (dia 1 do mês até o fim do dia do relatório, horário de Brasília).
2. Mesma conta do valor do dia: soma dos acordos criados no período, então o acumulado sempre bate com a soma dos fechamentos diários.
3. Vale para os dois formatos do relatório (consolidado e simples), incluindo o "Reenviar no WhatsApp".

Custo: uma consulta a mais só quando o relatório é gerado; nenhuma rotina nova.

Técnico: em `relatorio-acionamentos-sync/index.ts`, buscar `acordos.valor_total` com `criado_em` entre `${dia.slice(0,7)}-01T00:00:00-03:00` e `fimDia` (paginado via fetchAll), somar e inserir a linha nas duas mensagens; redeploy.
