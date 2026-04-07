

# Fix: Aquecimento — Add Delay Between Sends + Grace Period

## Problems

1. **No delay between sends**: The main loop (line 253) processes all instances sequentially with zero wait time. All messages fire within seconds, which triggers WhatsApp's spam detection and gets numbers banned.

2. **No grace period for new instances**: When a new WhatsApp is connected, it immediately starts sending messages. Newly connected numbers need at least 2 days of inactivity before the warming system begins sending.

3. **Delay config exists but is unused**: The `delay_config` (min/max seconds) is loaded from config at line 123 but never applied.

## Solution

### 1. Add delay between message sends (edge function)

**File: `supabase/functions/whatsapp-aquecimento/index.ts`**

After each successful or failed message send (around line 429, end of the send block), add a random delay using the existing `delayConfig`:

```typescript
// After sending each message, wait a random delay before the next
const delayMs = (delayConfig.min_segundos + Math.random() * (delayConfig.max_segundos - delayConfig.min_segundos)) * 1000;
console.log(`[AQUECIMENTO-AUTO] Aguardando ${Math.round(delayMs/1000)}s antes do próximo envio...`);
await new Promise(resolve => setTimeout(resolve, delayMs));
```

This uses the already-configured `delay_config` (default: 30-180 seconds between sends).

**Important**: Since edge functions have a timeout (~60s default), we also need to limit processing to only **1 instance per invocation** instead of looping through all. The cron runs every 15 minutes, so each cycle processes one instance with proper spacing.

### 2. Add 2-day grace period for new instances

**File: `supabase/functions/whatsapp-aquecimento/index.ts`**

In the main processing loop (line 253), after getting `instDetails`, add a check:

```typescript
const diasConectado = Math.floor((Date.now() - new Date(instDetails.criado_em).getTime()) / 86400000);
if (diasConectado < 2) {
  console.log(`[AQUECIMENTO-AUTO] ${instDetails.nome}: em carência (${diasConectado} dias). Pulando.`);
  continue;
}
```

This skips any instance connected less than 2 days ago. The status posting already has this check (line 445), but message sending does not.

### 3. Process only 1 instance per cycle

Change the loop to pick a single random eligible instance instead of iterating all. This ensures:
- Each 15-min cron cycle sends at most 1 message
- Natural spacing between different instances across cycles
- No edge function timeout risk

### 4. Update dashboard to show grace period badge

**File: `src/components/aquecimento/AquecimentoDashboard.tsx`**

Show an "Em carência" badge on instances connected less than 2 days ago, so the user knows why they aren't sending yet.

## Summary

| Change | File |
|--------|------|
| Add grace period (2 days) for new instances | `whatsapp-aquecimento/index.ts` |
| Process only 1 instance per cycle (not all at once) | `whatsapp-aquecimento/index.ts` |
| Add delay between sends using existing config | `whatsapp-aquecimento/index.ts` |
| Show "Em carência" badge on new instances | `AquecimentoDashboard.tsx` |

