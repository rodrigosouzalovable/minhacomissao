

## Alterar cron do aquecimento para 30min em horário comercial

### Alteração única via SQL

Remover o cron job atual e criar um novo com schedule `*/30 11-21 * * 1-6` — a cada 30 minutos, entre 11h e 21h UTC (8h-18h São Paulo), de segunda a sábado.

```sql
SELECT cron.unschedule('whatsapp-aquecimento-15min');

SELECT cron.schedule(
  'whatsapp-aquecimento-30min',
  '*/30 11-21 * * 1-6',
  $$ SELECT net.http_post(
    url:='https://cymdrkeukockakfzjeen.supabase.co/functions/v1/whatsapp-aquecimento',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5bWRya2V1a29ja2FrZnpqZWVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNjI0OTQsImV4cCI6MjA4MTYzODQ5NH0.mjcAvZDXLA6m46JCR474jZDHOF2WmWUXygChA4z__2U"}'::jsonb,
    body:='{"time": "now"}'::jsonb
  ) AS request_id; $$
);
```

Isso reduz as invocações de ~96/dia para ~22/dia (apenas horário comercial, dias úteis + sábado).

