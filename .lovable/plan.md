

## Plan: Enable Automatic WhatsApp Reminders for D-3, D0, D+1, D+2

### Summary
Enable automatic sending of payment reminders for all users, restricted to D-3, D0, D+1, and D+2 only. Uses instances marked "Apenas Lembretes". Starts today at 09:20 BRT.

---

### 1. Database Migration

**Enable reminders for all users:**
```sql
UPDATE profiles SET whatsapp_lembretes_habilitado = true;
```

**Set up pg_cron jobs** to run the two-step automation:
- `check-payment-reminders` at 09:20 BRT (12:20 UTC) daily — queues messages into `whatsapp_fila`
- `process-whatsapp-queue` every 5 minutes — sends queued messages that are due

```sql
SELECT cron.schedule('check-reminders-daily', '20 12 * * *', 
  $$SELECT net.http_post(
    url := '<supabase_url>/functions/v1/check-payment-reminders',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer <service_key>"}'::jsonb
  )$$
);

SELECT cron.schedule('process-whatsapp-queue', '*/5 * * * *',
  $$SELECT net.http_post(
    url := '<supabase_url>/functions/v1/process-whatsapp-queue',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer <service_key>"}'::jsonb
  )$$
);
```

### 2. Update Edge Function: `check-payment-reminders`

Currently the function queries D-3, D0, and ALL overdue days. Changes needed:

- **Add D+1 and D+2 queries**: Currently only D0 and D-3 are fetched for "próximas". Add queries for parcels due tomorrow (D+1 before due) and day after (D+2 before due). Wait — the user said D-3, D0, D+1, D+2. In the existing system convention: `3_dias` = 3 days before, `dia_vencimento` = day of. D+1 and D+2 mean 1 and 2 days **after** due date (overdue). These are already covered by the overdue query as `vencido_d1` and `vencido_d2`.

- **Restrict automatic mode to only D-3, D0, D+1, D+2**: When running without `overrideToken`, filter `todasParcelas` to only include `tipo_lembrete` in `['3_dias', 'dia_vencimento', 'vencido_d1', 'vencido_d2']`. This prevents sending for D+10, D+20, D+30 etc. automatically (those remain available via manual sending).

- The existing template-based filtering (`userConfiguredDaysMap`) will be secondary — the hard filter ensures only these 4 types go out automatically regardless of user template config.

### 3. No Frontend Changes

The automatic sending is purely backend-driven. The existing manual hub and admin toggle remain as-is. All users get `whatsapp_lembretes_habilitado = true` via the migration.

---

### Technical Details

- The cron uses `pg_net` (already enabled) to call the edge functions via HTTP
- `check-payment-reminders` queues messages with random 5-15 min delays into `whatsapp_fila`
- `process-whatsapp-queue` picks up messages where `agendado_para <= now()` and sends them
- Messages use default templates or user-configured custom templates from `lembrete_mensagens_templates`
- Instances with `apenas_lembretes = true` are used for credentials (already implemented)
- Sundays are blocked (already implemented)
- Dedup via `whatsapp_fila` and `whatsapp_lembretes_log` prevents duplicate sends (already implemented)

