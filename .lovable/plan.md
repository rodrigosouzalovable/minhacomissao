

## Problem

The "Enviando" badge with spinning icon doesn't appear during sequential message processing. The root cause is a **stale closure** issue: the `processNext` async function captures `allReminders` at the time `handleStartEnvios` is called, but this array may not match the current render's data. Additionally, the complex ID matching logic (`matchedReminder?.id || item.pagamento_id || item.id`) can produce a `reminderId` that doesn't match `r.id` in the `unifiedItems` mapping.

## Solution

Simplify the "enviando" tracking by storing the **currently-sending pagamento_id** in a dedicated `useState`, and checking it directly in the `unifiedItems` mapping. This avoids the stale closure problem entirely.

### Changes in `src/components/LembretesSection.tsx`

1. Add a new state: `const [currentSendingId, setCurrentSendingId] = useState<string | null>(null);`
2. In `processNext`, before invoking the send function, set `setCurrentSendingId(item.pagamento_id)` instead of relying on `localStatusOverride` for the 'enviando' state
3. After send completes (success or error), set `setCurrentSendingId(null)` and update `localStatusOverride` with 'enviado' or 'erro'
4. In the `unifiedItems` mapping, check `if (r.id === currentSendingId) whatsapp_status = 'enviando'` as the **highest priority** check (before `localStatusOverride` and `filaMatch`)

This guarantees the spinning badge appears because `currentSendingId` is a simple string comparison using the pagamento ID that both the whatsapp_fila query and usePaymentReminders share.

