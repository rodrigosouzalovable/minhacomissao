

## Comparativo Mensal no Dashboard

Adicionar uma seção de comparativo mês atual vs. mesmo período do mês anterior, mostrando indicadores de produtividade com variação percentual.

### O que será exibido

Um novo card "Comparativo com Mês Anterior" abaixo dos cards de resumo, com 4 métricas lado a lado:

1. **Acordos criados** - Quantidade de acordos criados do dia 1 até o dia atual do mês vs. o mesmo intervalo no mês anterior
2. **Valor total acordos** - Soma dos valores dos acordos no período
3. **Pagamentos recebidos** - Quantidade de pagamentos com status "pago" no período
4. **Valor recebido** - Soma dos valores dos pagamentos pagos no período

Cada métrica mostrará:
- Valor do mês atual
- Valor do mês anterior (mesmo intervalo de dias)
- Variação percentual com seta verde (subiu), vermelha (caiu) ou amarela (igual)

### Exemplo visual

```text
┌─────────────────────────────────────────────────────┐
│  📊 Comparativo com Mês Anterior (até dia 08)       │
├────────────┬────────────┬────────────┬──────────────┤
│ Acordos    │ Valor Ac.  │ Pgtos Rec. │ Valor Rec.   │
│ 12         │ R$ 45.000  │ 8          │ R$ 22.000    │
│ Ant: 10    │ Ant: 40k   │ Ant: 6     │ Ant: 18k     │
│ ▲ +20%     │ ▲ +12.5%   │ ▲ +33%     │ ▲ +22%       │
└────────────┴────────────┴────────────┴──────────────┘
```

### Implementação técnica

**Arquivo**: `src/pages/Dashboard.tsx`

1. **Calcular datas de comparação**: Usar `subMonths` do date-fns para obter o início do mês anterior e limitar ao mesmo dia atual (ex: se hoje é 08/04, comparar 01/04-08/04 vs 01/03-08/03)

2. **Nova query paralela**: Buscar acordos e pagamentos do mês anterior no mesmo `queryFn`, adicionando duas queries filtradas por data:
   - Acordos criados entre `inicioMesAnterior` e `mesmoDiaMesAnterior`
   - Pagamentos pagos no mesmo intervalo

3. **Novo componente inline**: Card com grid 2x2 ou 4 colunas mostrando cada métrica com Badge de variação

4. **Cálculo de variação**: `((atual - anterior) / anterior) * 100`, com tratamento para divisão por zero

Nenhuma alteração no banco de dados é necessária - os dados já existem nas tabelas `acordos` e `pagamentos`.

