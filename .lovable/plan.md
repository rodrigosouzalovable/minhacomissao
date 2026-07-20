## Objetivo
Permitir que apenas o **admin** edite inline o **valor de cada parcela**. Ao salvar, o `valor_total` do acordo é recalculado como a soma dos `valor_parcela` de todas as parcelas.

## Mudanças em `src/pages/AcordoDetalhe.tsx`

1. Adicionar states: `editandoValorParcela` (id) e `novoValorParcela` (string).
2. Renderizar, ao lado de `formatarMoeda(pagamento.valor_parcela)` (linha 951), um ícone de lápis visível **somente quando `isAdmin`**. Ao clicar, abre input inline (mesmo padrão da comissão) para digitar o novo valor (aceitando vírgula/ponto).
3. Criar função `atualizarValorParcela(pagamentoId, novoValor)`:
   - `UPDATE pagamentos SET valor_parcela = novoValor` para a parcela.
   - Recalcular `novoTotal = soma(valor_parcela)` das parcelas do acordo (usando o array em memória com o valor atualizado).
   - `UPDATE acordos SET valor_total = novoTotal` (mantém `parcelas`, `dias_atraso`, etc.).
   - Refetch dos pagamentos e do acordo, toast de sucesso.
4. Nenhuma alteração para não-admin — o ícone simplesmente não aparece.

## Observações
- Não recalculo comissão automaticamente ao mudar valor da parcela (a comissão por parcela já é editável separadamente pelo admin, mantendo o comportamento atual).
- RLS de `acordos` e `pagamentos` já permitem UPDATE global para admin (verificado).
