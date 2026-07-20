## Problema

O acordo do REGINALDO (1ª parcela venceu 15/05, sem pagamento, 155 dias em atraso) continua com status `ativo` no banco. Por isso:

1. O card mostra badge "Ativo" em vez de "QUEBRA DE ACORDO".
2. O trigger de CPF duplicado bloqueia outro usuário de lançar um novo acordo, porque a regra "todos os anteriores quebrados" não é satisfeita (o antigo ainda está `ativo`).

A causa é que a Edge Function `cleanup-acordos` hoje trata "10 dias sem nenhum pagamento" **excluindo o acordo** (e só marca como `quebrado` quando já houve alguma parcela paga e a próxima está 30+ dias atrasada). Como esse acordo foi lançado pelo admin, o usuário provavelmente espera que ele seja preservado como histórico de quebra — não apagado — e que a partir de 10 dias sem pagamento o status vire `quebrado` automaticamente.

## Mudança

Alterar a Edge Function `supabase/functions/cleanup-acordos/index.ts`:

- **Regra nova (10 dias sem nenhum pagamento):** em vez de excluir o acordo e reativar a dívida original, marcar o acordo como `quebrado`:
  - `UPDATE acordos SET status = 'quebrado' WHERE id = ...`
  - Excluir apenas as parcelas `pendente` desse acordo (mantém o histórico do acordo e das parcelas pagas — que aqui não existem).
  - **Não** reativar `devedores` (a dívida original permanece "coberta" pelo registro de quebra; o novo acordo poderá ser lançado por qualquer usuário graças ao trigger já existente que permite duplicidade quando todos os anteriores estão `quebrado`).
- **Regra existente (30+ dias com parcela pendente após ter pago algo):** permanece igual — marca como `quebrado`.
- **Componente `AcordosAbandonadosDialog`:** hoje mostra acordos `ativo` sem pagamento com 10+ dias e permite excluir. Como o cleanup passará a quebrá-los automaticamente, a lista naturalmente esvazia. Mantenho o componente como está (ferramenta manual de exclusão continua útil para admin).
- **Trigger de CPF duplicado:** já contempla o caso "todos quebrados" — sem alteração.

## Execução imediata para o caso do REGINALDO

Após o deploy, rodar `cleanup-acordos` uma vez para que o acordo do REGINALDO (e outros na mesma situação) passe a `quebrado` imediatamente, liberando o novo lançamento.

## Fora do escopo

- UI dos cards: quando o status virar `quebrado`, o badge "QUEBRA DE ACORDO" já é renderizado pela lógica atual — nada a mudar.
- Cronograma do cleanup: permanece o agendamento atual.
- Nenhuma mudança em RLS, storage, ou no fluxo de lembretes.

## Verificação

1. Rodar `cleanup-acordos` e confirmar que o acordo do REGINALDO fica `status = 'quebrado'` e parcelas pendentes removidas.
2. Como usuário não-admin, lançar novo acordo com o mesmo CPF → deve permitir.
3. Card do acordo antigo deve exibir "QUEBRA DE ACORDO".
