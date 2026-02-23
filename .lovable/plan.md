

# Corrigir Estrategias de Cobranca - Query URL muito longa

## Problema
A query de pagamentos esta falhando com erro **400 Bad Request** porque a URL gerada pelo filtro `.in('acordo_id', acordoIds)` e muito longa. Com mais de 200 acordos ativos, a URL excede o limite permitido pelo servidor.

## Solucao
Dividir a busca de pagamentos em lotes (batches) de 50 IDs por vez, para manter a URL dentro do limite. Depois, combinar todos os resultados.

## Detalhes Tecnicos

**Arquivo:** `src/components/EstrategiasCobranca.tsx`

Na funcao `queryFn`, apos obter a lista de `acordoIds`, dividir em lotes de 50 e fazer multiplas queries em paralelo:

```typescript
// Buscar pagamentos em lotes de 50 para evitar URL muito longa
const BATCH_SIZE = 50;
const batches = [];
for (let i = 0; i < acordoIds.length; i += BATCH_SIZE) {
  batches.push(acordoIds.slice(i, i + BATCH_SIZE));
}

const pagamentosResults = await Promise.all(
  batches.map(batch =>
    supabase
      .from('pagamentos')
      .select('acordo_id, status, valor_parcela, data_prevista')
      .in('acordo_id', batch)
  )
);

const pagamentos = pagamentosResults.flatMap(r => {
  if (r.error) throw r.error;
  return r.data ?? [];
});
```

O mesmo padrao sera aplicado a query de `profiles` caso tambem tenha muitos IDs, embora seja menos provavel que exceda o limite.

Nenhuma alteracao no banco de dados e necessaria. Apenas a logica de fetch no componente precisa ser ajustada.
