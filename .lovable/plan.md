## Problema

Na importação de pagamentos, o cliente **Luiz Cosmo do Nascimento Filho** (parcela 1, já paga em 20/07/2026) aparece como **"Pronto para marcar"** contra a parcela 2 (`1 (sist. 2)` na coluna Parcela do preview), quando deveria aparecer como **"Já pago"**.

## Causa (confirmada em `src/components/ImportarPagosDialog.tsx`)

Na função `avaliarLinhas` (linhas 130-165), a ordem atual é:

1. Procura parcela **pendente** com o número informado na planilha (parcela 1) → não acha (já está paga).
2. **Fallback**: pega a primeira parcela pendente qualquer → acha parcela 2 → marca como "Pronto para marcar".
3. Só verifica `ja_pago` se o fallback também falhar.

Ou seja: quando o número da parcela da planilha bate com uma parcela **já paga** do sistema, o sistema ignora esse fato e casa a linha com outra parcela pendente qualquer.

## Correção

Reordenar a lógica em `avaliarLinhas` para que, **quando `linha.parcela` é informado**, a verificação de "já pago" venha ANTES do fallback para "próxima pendente".

Novo fluxo, para cada acordo do CPF:

1. Se `linha.parcela` foi informado:
   - Se a parcela exata está `pago` → retorna imediatamente `ja_pago`.
   - Se a parcela exata está `pendente` e o valor bate → retorna `pronto` (ou `valor_divergente`).
2. Só se `linha.parcela` não foi informado (ou o acordo não tem essa parcela), cair no fallback atual de "primeira pendente disponível em ordem".
3. Se nenhum acordo tem candidato aplicável → mantém `sem_parcela_pendente`.

## Detalhes técnicos

- Arquivo único alterado: `src/components/ImportarPagosDialog.tsx`.
- Nenhuma mudança de schema, RLS ou edge function.
- Preserva o comportamento de `usados` para não reservar a mesma parcela duas vezes.
- Mantém tolerância de R$ 0,01 e opção "marcar mesmo com valor divergente".

## Validação

- Reimportar a mesma planilha e conferir que Luiz Cosmo passa a mostrar **"Já pago"** e é removido da contagem "Pronto para marcar".
- Os demais casos (Jardel Sena, Leide Daiane, etc., que estão pendentes) continuam como "Pronto para marcar".
- Linhas sem número de parcela na planilha continuam usando a primeira pendente disponível.