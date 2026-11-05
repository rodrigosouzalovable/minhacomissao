# Valor em acordos sempre igual ao do WhatsApp + botão Atualizar

## Por que os valores diferem
- A aba Relatórios mostra a soma do valor gravado hora a hora no relatório, que só é atualizado quando a coleta roda.
- O relatório do WhatsApp ("Reenviar") soma na hora todos os acordos realmente criados no dia. Por isso ele sai maior/diferente.

## O que vou fazer
1. "Valor em acordos" passa a usar a mesma conta do WhatsApp: soma dos acordos criados no dia escolhido (00h–23h59 horário de Brasília), lida direto dos acordos.
2. Botão de atualizar (ícone de giro) ao lado de "Valor em acordos": ao clicar, refaz a soma na hora e mostra o horário da última atualização.
3. O valor também é recalculado ao abrir a página, ao trocar a data e ao clicar em "Atualizar agora".
4. Gráfico por hora e demais números continuam como estão.

Sem atualização automática periódica (sem custo extra) — só ao abrir ou clicar.

## Detalhes técnicos
- Em `src/pages/Relatorios.tsx`, nova função que busca `acordos.valor_total` com `criado_em` entre início/fim do dia BRT, paginada de 1.000 em 1.000 (mesmo critério de `relatorio-acionamentos-sync`), e passa o total para `FunilAcionamentosCard`.
- `FunilAcionamentosCard` recebe `onAtualizarValor` e `atualizandoValor` e exibe o botão `RefreshCw` ao lado do rótulo.
- Respeita as permissões atuais de leitura dos acordos (admin vê todos).
