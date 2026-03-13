

## Problem

The spreadsheet uses 0-based parcela numbering (0, 1, 2, 3, 4...) while the system stores parcelas starting at 1 (1, 2, 3, 4, 5...). This mismatch causes 83 rows to show as "sem acordo" because `parcelas.find(p => p.numero_parcela === row.numero_parcela)` fails when comparing 0 vs 1.

## Fix

In `parsePagamentos`, after grouping raw rows by CPF, detect if any CPF group has a parcela numbered 0. If so, add 1 to all parcela numbers for that CPF group (shifting 0→1, 1→2, etc.).

### File: `src/pages/ImportarDevedores.tsx`

**After line 309 (after the `for` loop that builds `rawRows`), before the matching logic:**

```typescript
// Detect 0-based parcela numbering per CPF and shift to 1-based
const cpfGroups = new Map<string, PagamentoRow[]>();
for (const row of rawRows) {
  if (!cpfGroups.has(row.cpf)) cpfGroups.set(row.cpf, []);
  cpfGroups.get(row.cpf)!.push(row);
}
for (const [, rows] of cpfGroups) {
  const hasZero = rows.some(r => r.numero_parcela === 0);
  if (hasZero) {
    for (const r of rows) {
      r.numero_parcela += 1;
    }
  }
}
```

This automatically converts 0-based numbering (0,1,2,3,4) to 1-based (1,2,3,4,5) per CPF, matching the system's convention.

