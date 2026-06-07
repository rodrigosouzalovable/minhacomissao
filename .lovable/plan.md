## Ajuste na aba Análise — Financeiro

### Problema
Hoje a coluna **Receita Gerada** mostra apenas a parte do escritório (H.O.) sobre as parcelas pagas. O usuário quer que essa coluna mostre o **valor bruto total recebido** do funcionário no período (soma de `valor_parcela` das parcelas com `status = 'pago'` cuja `data_paga` está dentro do filtro).

A coluna **Comissão Funcionário** já é calculada sobre as mesmas parcelas filtradas por `data_paga`, então só precisa ser confirmada visualmente — nenhuma mudança de lógica.

### Mudança em `src/pages/Financeiro.tsx`

No `useMemo` `analisesPorFuncionario` (linhas 294-325), trocar:

```ts
receita += r.receita;   // hoje: valor_parcela * % escritório
```

por:

```ts
receita += Number(p.valor_parcela);   // total bruto pago no período
```

`comissaoFuncionario` e `comissaoEscritorio` continuam iguais (cada um calculado pela sua tabela respeitando empresa do acordo). `resultado` continua = `comissaoEscritorio − gastos`.

A query `pagamentosPagos` já filtra por `data_paga` entre `dataInicio` e `dataFim` (linhas 228-233), então o filtro de datas é aplicado automaticamente em todas as três colunas.

### Verificação
- Mudar o DateRangePicker no topo da página → as 3 colunas (Receita Gerada, Comissão Funcionário, Comissão Escritório) recalculam para o período.
- "Receita Gerada" passa a refletir o **total recebido** do cliente (ex.: R$ 51.596,49 = soma das parcelas pagas), não mais a fatia do escritório.
- "Comissão Funcionário" mostra exatamente o que o funcionário ganhou nessas parcelas.

### Fora de escopo
Não há mudança em queries, schema, totais gerais do dashboard ou outras abas.
