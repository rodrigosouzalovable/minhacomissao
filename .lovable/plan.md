## Objetivo

Mudar a lógica de casamento da importação de pagos para usar **o mês do pagamento** (coluna N da planilha) como chave principal, em vez de "próxima parcela pendente" / número da parcela. Se nenhum acordo do CPF tiver parcela com `data_prevista` no mesmo mês/ano da data da planilha, marcar como **"Erro na Data"** para revisão manual.

## Contexto do bug

Maria Clarinete (CPF 369.639.921-34) tem 2 acordos, ambos **quebrados**, com parcela 1 vencendo em 16/04/2026 (já paga em 23/04). A planilha traz pagamento em **20/07/2026** referente à parcela 1. A lógica atual encontrou "parcela 1 já paga" e retornou **Já pago** — mas na verdade não existe parcela nenhuma no sistema com vencimento em julho/2026, então o correto é destacar como erro para conferência.

## Mudanças em `src/components/ImportarPagosDialog.tsx`

1. **Novo status** `erro_data` com label "Erro na Data" e badge destrutiva (vermelha), incluído em `statusLabel` e `statusVariant`.

2. **Reescrever `avaliarLinhas`** com nova ordem de decisão por linha, baseada no mês/ano de `linha.dataPagamento`:

   - Para cada CPF, juntar **todas as parcelas de todos os acordos ativos/quebrados** (mantendo a busca já existente).
   - Filtrar apenas as parcelas cuja `data_prevista` esteja no **mesmo mês/ano** da data do pagamento da planilha.
   - Se **não houver nenhuma parcela nesse mês** em nenhum acordo do CPF → status `erro_data` (mostra também que não achou acordo daquele mês).
   - Se houver parcelas nesse mês:
     - Se **alguma já estiver paga** (e ainda não usada nesta importação) → status `ja_pago` apontando para essa parcela.
     - Se houver **pendente** disponível → escolher (preferindo casamento pelo `numero_parcela` da planilha quando informado, senão a primeira pendente do mês) e reservar em `usados`. Comparar valor → `pronto` ou `valor_divergente` conforme tolerância atual (R$ 0,01).
   - Se o CPF não tiver **nenhum acordo** → continua `sem_acordo` (comportamento atual).
   - `sem_parcela_pendente` deixa de ser retornado pelo caminho normal — só sobra caso todas as parcelas do mês já estejam pagas e outra linha da mesma importação já tenha reservado a última pendente. Nesse caso volta a mostrar `sem_parcela_pendente`.

3. **UI**: incluir badge do novo status no resumo do topo e permitir que a checkbox "incluir divergentes" continue funcionando igual. Linhas em `erro_data` **nunca** entram no lote de aplicáveis — só servem para conferência manual.

## O que NÃO muda

- Parse da planilha (`parsePagamentosCobmais`) permanece igual.
- Busca de acordos por CPF (com variantes formatadas e só-dígitos) permanece igual.
- Update no banco (`pagamentos.status = 'pago'` com `data_paga`) permanece igual.
- Tolerância de R$ 0,01 e a lógica de "incluir divergentes" permanecem iguais.

## Resultado esperado no caso da Maria Clarinete

- Planilha: 20/07/2026, parcela 1, R$ 101,59.
- Sistema: parcelas dela vencem em 04/2026, 05/2026, etc. — nenhuma em 07/2026.
- Novo status exibido: **Erro na Data** (badge vermelha), permitindo tratamento manual em vez de marcação incorreta.
