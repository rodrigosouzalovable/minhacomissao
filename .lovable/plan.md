

# Alterar Juros do Parcelamento para 1% Fixo

## Problema
Atualmente a taxa de juros do parcelamento e progressiva (1% a 3% dependendo do numero de parcelas). O usuario quer uma taxa fixa de **1% a.m.** independente do numero de parcelas.

## Solucao
Alterar a funcao `getTaxaJurosMensal` em `src/components/devedor/CalculadoraDebitoDialog.tsx` para retornar sempre 1% (0.01) quando houver mais de 1 parcela.

## Detalhe Tecnico

**Arquivo:** `src/components/devedor/CalculadoraDebitoDialog.tsx`

Codigo atual (linhas 48-54):
```typescript
const getTaxaJurosMensal = (numParcelas: number): number => {
  if (numParcelas <= 1) return 0;
  if (numParcelas <= 12) return 0.01;
  if (numParcelas <= 24) return 0.015;
  if (numParcelas <= 36) return 0.02;
  if (numParcelas <= 48) return 0.025;
  return 0.03;
};
```

Codigo novo:
```typescript
const getTaxaJurosMensal = (numParcelas: number): number => {
  if (numParcelas <= 1) return 0;
  return 0.01;
};
```

Nenhuma outra alteracao necessaria -- as funcoes `getTaxaJurosLabel`, `ajustarTaxaPorFrequencia`, `calcularPMT` e o PDF ja usam o retorno dessa funcao.

