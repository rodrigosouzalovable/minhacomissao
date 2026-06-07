## Objetivo

Quando o funcionário (não-admin) lançar um acordo em **Novo Acordo**, exibir:

1. A **tabela de comissionamento do funcionário** com todas as faixas de atraso (1–60: 2%, 61–90: 3%, 91–180: 4%, 181–360: 6%, 361–720: 8%, 721+: 10%), destacando a faixa correspondente aos "Dias em Atraso" digitados.
2. O **valor que ele irá receber** com aquele contrato (% aplicado sobre o valor total do acordo, somando primeira parcela + demais).

Admins continuam vendo o card atual de "Cálculo da Comissão" (Honorário da empresa) — sem mudança.

## Mudanças

### `src/pages/NovoAcordo.tsx`

- Importar de `@/lib/comissao`: `tabelaComissoesFuncionario`, `calcularPercentualComissaoFuncionario`, `calcularComissaoFuncionarioParcela`.
- Após o card admin atual (linha ~912), adicionar um novo card **"Sua Comissão"** que renderiza **apenas para não-admins** (`!isAdmin`) e somente quando `calculo` existe (mesmas condições de validade dos campos).
- Conteúdo do novo card:
  - Linha de destaque com `Faixa atual: Xd → Y%` e `Você receberá: R$ X,XX` (calculado como `comissaoPrimeira + comissaoDemais × (parcelas−1)` usando a tabela do funcionário).
  - Tabela compacta com todas as faixas (Atraso / %), grifando a linha ativa via classe (`bg-secondary/10 font-semibold`).
- Não alterar o cálculo enviado ao banco; é apenas preview visual. Comissão real do funcionário continua sendo gravada por parcela como já é hoje.

## Verificação

- Como funcionário: ao preencher Valor + Parcelas + Dias em Atraso, aparece o card "Sua Comissão" com a tabela e o valor a receber. Mudar "Dias em Atraso" reavalia a faixa destacada e o valor.
- Como admin: card atual continua igual, novo card não aparece.

## Fora de escopo

- Comissão da empresa / Honorário.
- Páginas Comissões / EditarAcordo.
