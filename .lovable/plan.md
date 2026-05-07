## Adicionar coluna "Comissão Montreal" no export de parcelas

No arquivo `src/pages/Clientes.tsx` (função de "Exportar Parcelas (Excel)"), adicionar 2 novas colunas após "Valor Parcela":

- **% Comissão** — percentual aplicado sobre a parcela paga
- **Comissão Montreal (R$)** — valor da comissão calculado

### Regra de cálculo

Usar `calcularComissaoMontrealParcela(valor_parcela, diasAtraso)` de `src/lib/comissao.ts`, onde `diasAtraso = data_pagamento - data_vencimento` (em dias corridos).

Tabela MONTREAL já existente:
- 31–60 dias → 8%
- 61–90 → 15%
- 91–180 → 20%
- 181–360 → 25%
- 361–720 → 30%
- 721–1800 → 35%
- Fora dessas faixas (≤30 dias ou parcela não paga) → 0% / vazio

### Comportamento

- Parcela **Paga**: calcula `% e valor` com base no atraso real (pagamento − vencimento).
- Parcela **Pendente/Atrasada**: colunas ficam vazias ("—" ou em branco).
- Aplica somente quando o credor exportado for **MONTREAL** (filtro já existente). Para "todos", calcular apenas nas linhas do credor MONTREAL; demais ficam vazias.

### Arquivos afetados

- `src/pages/Clientes.tsx` — adicionar 2 campos no `exportRows.map(...)` e 2 entradas no array `colunas`.

Sem mudanças de backend, schema ou outras telas.