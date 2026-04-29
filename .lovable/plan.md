
## Objetivo

Aplicar a tabela de comissão da MONTREAL (H.O./Encargos) em cada acordo lançado para clientes da Montreal, exibindo, ao lado de cada parcela marcada como **paga**, o **percentual** e o **valor em reais** da comissão a receber.

## Tabela de comissão Montreal

Faixa de atraso → percentual sobre o valor da parcela paga:

| Atraso (dias) | % Comissão |
|---|---|
| 31 – 60 | 8% |
| 61 – 90 | 15% |
| 91 – 180 | 20% |
| 181 – 360 | 25% |
| 361 – 720 | 30% |
| 721 – 1800 | 35% |

Fora dessas faixas (0–30 dias e acima de 1800): 0%.

## Onde os "acordos Montreal" vivem hoje

Os acordos da Montreal **não** ficam na tabela `acordos` (que só usa `mundo_da_moda` / `ume_novo_mundo`). Eles ficam em:

- `acordos_devedor` — cabeçalho do acordo (CPF, valor total, nº parcelas, data 1º venc.)
- `parcelas_devedor` — cada parcela (`valor`, `data_vencimento`, `pago`, `data_pagamento`)

Um acordo é "Montreal" quando o CPF do devedor tem registros em `devedores` com `credor = 'MONTREAL'`. A UI atual está em `src/components/devedor/AcordoDevedorSection.tsx` (renderizada em `DevedorDetalhe`).

## Definição do "atraso em dias" usada no cálculo

Para cada parcela paga, calcular:

```
diasAtraso = data_pagamento − data_vencimento_original_da_dívida_mais_antiga_do_CPF_na_Montreal
```

Ou seja, usamos a data de vencimento **original** da dívida (campo `devedores.data_vencimento` mais antigo do CPF naquele credor) como referência — é o que define a "idade" da inadimplência, não a data da parcela do acordo.

Caso não exista dívida Montreal cadastrada para o CPF (acontece em ~1 dos 7 acordos atuais), usar fallback: `diasAtraso = data_pagamento − data_primeiro_vencimento` do próprio acordo. Nesse caso, marcar visualmente como "atraso estimado".

> Se você preferir outra regra (por ex. usar a data de criação do acordo, ou a data de vencimento da própria parcela), me avise antes da implementação que ajusto.

## Mudanças

### 1. Nova função utilitária — `src/lib/comissao.ts`

Adicionar:

```ts
export const tabelaComissoesMontreal = [
  { min: 31, max: 60, percentual: 8 },
  { min: 61, max: 90, percentual: 15 },
  { min: 91, max: 180, percentual: 20 },
  { min: 181, max: 360, percentual: 25 },
  { min: 361, max: 720, percentual: 30 },
  { min: 721, max: 1800, percentual: 35 },
];

export function calcularPercentualComissaoMontreal(diasAtraso: number): number { ... }
export function calcularComissaoMontrealParcela(valorParcela: number, diasAtraso: number) {
  const percentual = calcularPercentualComissaoMontreal(diasAtraso);
  return { percentual, valor: Math.round(valorParcela * percentual / 100 * 100) / 100 };
}
```

### 2. Buscar referência de atraso por CPF — `AcordoDevedorSection.tsx`

Em `fetchAcordos`, após carregar acordos/parcelas, fazer **uma** consulta:

```ts
supabase.from('devedores')
  .select('data_vencimento, credor')
  .eq('cpf', cpfNorm)
  .ilike('credor', 'MONTREAL')
  .order('data_vencimento', { ascending: true })
  .limit(1);
```

Guardar em estado `vencimentoOriginalMontreal: string | null`. Definir `isMontreal = vencimentoOriginalMontreal !== null` (ou também checar se existe qualquer registro Montreal mesmo sem data, com fallback descrito acima).

### 3. Renderizar comissão na linha de cada parcela paga

Na tabela de parcelas existentes (linhas onde `parcela.pago === true`), adicionar uma nova coluna **"Comissão"** (visível somente quando `isMontreal`):

```text
┌────┬────────────┬───────────┬──────────┬───────────────────┬────────┐
│ Nº │ Vencimento │ Valor     │ Status   │ Comissão (Montreal)│ Ações │
├────┼────────────┼───────────┼──────────┼───────────────────┼────────┤
│  1 │ 10/02/2026 │ R$ 500,00 │ Paga     │ 20% • R$ 100,00   │ ...    │
│  2 │ 10/03/2026 │ R$ 500,00 │ Pendente │ —                 │ ...    │
└────┴────────────┴───────────┴──────────┴───────────────────┴────────┘
```

Cabeçalho extra: aparece apenas para clientes Montreal. Para parcelas não pagas, mostrar "—".

### 4. Rodapé do acordo: total de comissão acumulada

Logo abaixo da tabela do acordo (somente Montreal), exibir um pequeno resumo:

> "Comissão Montreal acumulada (parcelas pagas): **R$ X,XX**"

Soma de `comissao.valor` de todas as parcelas com `pago = true`.

### 5. Sem mudanças no banco

Como o cálculo é determinístico a partir de dados já existentes (`parcelas_devedor.valor`, `parcelas_devedor.data_pagamento`, `devedores.data_vencimento`), **não é preciso criar coluna nem migration**. Isso mantém custo zero e flexibilidade — se a tabela mudar, recalcula automaticamente.

## Arquivos a alterar

- `src/lib/comissao.ts` — adicionar tabela e helpers Montreal.
- `src/components/devedor/AcordoDevedorSection.tsx` — buscar vencimento original, renderizar coluna "Comissão" e rodapé de total.

## Pontos a confirmar antes de implementar

1. **Referência de atraso**: usar a data de vencimento original mais antiga da dívida Montreal do CPF (recomendado), ou outra data?
2. **Faixas 0–30 dias e >1800 dias**: confirmar que comissão = 0% (sua tabela não cobre essas faixas).
3. **Acordos Montreal lançados em outro lugar?** Se você também lança acordos da Montreal na tela "Novo Acordo" (tabela `acordos`), me avise — hoje essa tela só aceita "MUNDO DA MODA" e "UME | NOVO MUNDO", então assumi que todos os acordos Montreal estão em `acordos_devedor`.
