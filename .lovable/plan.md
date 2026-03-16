

## Plan: Restrict automatic reminders to "Apenas Lembretes" instances + block Sundays

### Problem
1. **Fallback credentials**: When no instance is marked as "Apenas Lembretes", the system falls back to profile-level WhatsApp credentials (`whatsapp_lembrete_server_url`/`whatsapp_lembrete_instance_token`), allowing messages to be sent anyway.
2. **Sunday sending**: Neither the scheduling function nor the queue processor blocks Sundays.

### Changes

#### 1. Edge Function `check-payment-reminders/index.ts`
- **Sunday block**: After calculating the scheduling time (`proximoHorario`), if the day falls on Sunday (day 0 in Brasilia timezone), skip to Monday 08:00 BRT.
- **Remove credential fallback**: When NOT in override mode, if no `apenas_lembretes` instance exists for the user (`instancesMap`), skip the reminder entirely. Remove the fallback to `profile.whatsapp_lembrete_server_url` / `profile.whatsapp_lembrete_instance_token`.

**Lines ~274-284** — change credential resolution:
```
// Before (fallback to profile credentials):
const inst = instancesMap.get(acordo.user_id);
finalServerUrl = inst?.server_url || profile.whatsapp_lembrete_server_url || null;
finalInstanceToken = inst?.instance_token || profile.whatsapp_lembrete_instance_token || null;

// After (no fallback, skip if no apenas_lembretes instance):
const inst = instancesMap.get(acordo.user_id);
if (!inst) { pulados++; continue; }
finalServerUrl = inst.server_url;
finalInstanceToken = inst.instance_token;
```

**Lines ~339-345** — add Sunday skip logic when advancing `proximoHorario`:
```
// After checking hora >= 18, also check if it's Sunday
// If Sunday in BRT, advance to Monday 08:00 BRT (11:00 UTC)
```

#### 2. Edge Function `process-whatsapp-queue/index.ts`
- Add a Sunday check (Brasilia timezone) alongside the existing business hours check. If it's Sunday, skip processing and return early.

#### 3. Frontend `WhatsAppSendingContext.tsx` (automatic sending loop)
- No changes needed here — this context handles manual sends from the dialog which are user-initiated and not subject to the "apenas lembretes" restriction per the routing strategy.

### Summary
- 2 files modified (both edge functions)
- No database changes needed

