

## Corrigir logica de desabilitacao das faixas de desconto

### Problema

A logica atual calcula `valorComDesconto / maxParcelas` para decidir se a faixa esta disponivel. Por exemplo, para o valor de R$ 839,34:

- **2 a 6x (40% off)**: R$ 503,60 / 6 = R$ 83,93 (desabilitado). Porem, com 2 parcelas seria R$ 251,80 e com 5 seria R$ 100,72 -- ambos acima de R$ 90.
- **7 a 12x (30% off)**: R$ 587,54 / 12 = R$ 48,96 (desabilitado). Porem, com 7 parcelas seria R$ 83,93... na verdade com 6 parcelas seria R$ 97,92.

O correto e verificar se pelo menos a parcela **minima** da faixa gera um valor >= R$ 90. Se sim, a faixa fica habilitada, e o numero maximo de parcelas sera limitado dinamicamente no formulario.

### Solucao

**Arquivo:** `src/components/negociacao/DiscountTierSelector.tsx`

Alterar a logica de `disabled` de:

```typescript
const maxParcelas = getMaxParcelasFaixa(tier.faixa);
const valorParcela = valorComDesconto / maxParcelas;
const disabled = valorParcela < VALOR_MINIMO_PARCELA;
```

Para:

```typescript
const minParcelas = getMinParcelas(tier.faixa);
const valorParcelaMin = valorComDesconto / minParcelas;
const disabled = valorParcelaMin < VALOR_MINIMO_PARCELA;
```

Isso significa: a faixa so sera desabilitada se nem mesmo com o menor numero de parcelas possivel o valor da parcela atingir R$ 90. O limite real de parcelas ja e calculado em `ConsultaResultado.tsx` pelo `getMaxParcelas`, que respeita o piso de R$ 90.

Sera necessario importar `getMinParcelas` do mesmo arquivo (ja esta exportado).

