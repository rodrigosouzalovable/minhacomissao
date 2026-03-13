

## Problem

The `check-payment-reminders` edge function runs with service role privileges and schedules reminders for **ALL users' clients**, not just the logged-in user's. The frontend list (via `usePaymentReminders`) correctly shows only the user's own clients, but when "Iniciar Envio" is clicked, the edge function processes everyone's parcelas — which is why messages from Daniela's clients were sent from your account.

## Solution

Pass the authenticated user's ID from the frontend to the edge function, and filter parcelas in the function to only process that user's agreements.

### Changes

**1. `src/components/LembretesSection.tsx`**
- Import `useAuth` and get the current `user.id`
- Send `user_id` in the body when invoking `check-payment-reminders`

**2. `supabase/functions/check-payment-reminders/index.ts`**
- Read `user_id` from the request body
- Add `.eq('acordos.user_id', user_id)` filter to both the `parcelasProximas` and `parcelasVencidas` queries, so only the logged-in user's clients are scheduled
- When no `user_id` is provided, keep existing behavior (for backward compatibility with cron/admin usage)

This ensures the reminder list and the actual sending are both scoped to the logged-in user's client base only.

