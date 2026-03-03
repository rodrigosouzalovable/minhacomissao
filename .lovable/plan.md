

## Plan: Add Payment Variables (`{avista}` and `{parcelado}`) to Acionamento

### What will change

Two new dynamic variables will be available in the messaging system:

1. **`{avista}`** — Shows the debt value with 50% discount, formatted as currency (e.g., `R$ 790,50`)
2. **`{parcelado}`** — Auto-generates all installment options from 2x to 24x (with 30% discount), filtering out any option where the installment value is below R$120,00. Each option is displayed on its own line (e.g., `- 3x de R$ 368,90`)

### Example output

For a client with saldo R$ 1.581,00:
- `{avista}` → `R$ 790,50`
- `{parcelado}` →
```
- 2x de R$ 553,35
- 3x de R$ 368,90
- 4x de R$ 276,68
- 5x de R$ 221,34
- 6x de R$ 184,45
- 7x de R$ 158,10
- 8x de R$ 138,34
- 9x de R$ 122,97
```
(stops at 9x because 10x = R$ 110,67 < R$ 120,00)

### Technical changes

**1. `src/pages/Acionamento.tsx`**
- Update the `variables` array to include `{avista}` and `{parcelado}` with descriptions
- Update the `replaceVariables` function to calculate:
  - `{avista}`: `saldo * 0.5` formatted as BRL currency
  - `{parcelado}`: iterate 2x–24x on `saldo * 0.7`, keep only where `valor / parcelas >= 120`, format each as `- Nx de R$ X,XX` joined by newlines

**2. `src/hooks/useAutoSend.tsx`**
- Update the `replaceVariables` function with the same logic (this is used during auto-send)

Both files have their own `replaceVariables` — both need the same update. The minimum installment threshold will be R$ 120,00 as specified.

