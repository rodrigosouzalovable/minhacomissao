

## Problem

Two different data sources are showing conflicting numbers:

1. **Lista unificada** (from `usePaymentReminders`): Shows **144** parcelas vencidas — this queries `pagamentos` directly filtered by your `user_id`
2. **"Envios do dia"** stats (from `whatsapp_fila`): Shows **88** messages — this is how many the edge function actually scheduled

The difference (144 vs 88) happens because the edge function skips parcelas that:
- Have no phone number (`cliente_telefone` null)
- Belong to agreements not marked `ativo`
- Were already sent before (dedup via `whatsapp_lembretes_log`)
- Don't match your configured template days (e.g., you only have templates for D+1, D+10, not every day)
- Profile has `whatsapp_lembretes_habilitado = false`

So 56 parcelas were skipped by the edge function but still appear in the UI list.

## Solution

Sync the progress bar with the unified list. The progress should show **"X de 144"** (total items in the list), and items that were skipped by the edge function (no phone, wrong day, etc.) should show a distinct status like "Sem telefone" or remain as "Não enviado".

### Changes

**`src/components/LembretesSection.tsx`**
- Replace `stats.total` with `unifiedItems.length` in the progress bar denominator
- Use `unifiedItems` count for "enviados de X mensagens" display
- Keep `stats.enviados` for the numerator (actual sent count) but compute it from `unifiedItems` statuses instead
- Show accurate counts: enviados, erros, pendentes, and não enviados all from the unified list

This way the user sees consistent numbers: the list has 144 items, and the progress says "16 de 144".

