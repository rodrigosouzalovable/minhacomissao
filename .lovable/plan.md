

# Fix: WhatsApp Warming System — Phone Number Extraction

## Problem
All 148 warming interactions today **FAILED** because the system extracts phone numbers incorrectly from instance names.

The instance names follow the pattern: `62982184718 1 N1` (phone number + description). The current code strips ALL non-digit characters, which merges the phone digits with description digits:
- `62982198675 10 WORK B1 ZAP BOOOT` → `62982198675101` (wrong)
- Should be → `62982198675`

Then it prepends `55`, making `55629821847181` — a completely invalid WhatsApp number.

## Fix

**File: `supabase/functions/whatsapp-aquecimento/index.ts`** (line ~365)

Change the phone extraction from:
```typescript
const destinoPhone = destinoDetails.nome?.replace(/\D/g, "") || "";
```
To extract only the **first continuous block of digits** from the name:
```typescript
const destinoPhone = destinoDetails.nome?.match(/^\d+/)?.[0] || "";
```

This matches `^\d+` — digits at the **start** of the name only — so `62982198675 10 WORK B1` correctly extracts `62982198675`.

Apply the same fix to the origin phone extraction if it exists elsewhere in the function.

Additionally, verify whether prepending `55` is correct — the numbers already start with `62` (area code), so they likely already include the country code or need only `55` prefix without duplication. The current code on line 377 does `55${destinoPhone}@s.whatsapp.net`. Since the numbers are `629821...` (11 digits, area code 62), this produces `5562982...` which is correct (country code + number).

## Summary
- 1 file changed: `supabase/functions/whatsapp-aquecimento/index.ts`
- Fix phone extraction regex to use only the first digit block from instance name
- Redeploy the edge function

