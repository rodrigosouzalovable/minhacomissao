

## Plan: Reorder reminder sections and sort by date

### Changes

#### 1. `src/components/PaymentReminders.tsx` (lines 436-491)
Swap the section order so "Vence Hoje" appears first, then "Parcelas Vencidas", then "Vence em 3 dias".

#### 2. `src/hooks/usePaymentReminders.tsx`
Sort `lembretesVencidos` by `data_prevista` descending (most recent overdue first — e.g., yesterday before last week). Also sort `lembretesHoje` and `lembretesTresDias` by `data_prevista` descending for consistency.

Add sorting before returning:
```typescript
const sortByDateDesc = (a, b) => 
  new Date(b.data_prevista).getTime() - new Date(a.data_prevista).getTime();

lembretesVencidos.sort(sortByDateDesc);
lembretesHoje.sort(sortByDateDesc);
lembretesTresDias.sort(sortByDateDesc);
```

### Summary
- 2 files modified
- No database changes

