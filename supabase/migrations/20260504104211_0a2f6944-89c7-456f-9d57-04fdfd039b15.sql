SELECT cron.schedule(
  'aquecimento-auto-horario-economico',
  '0 11-23 * * *',
  $$
  SELECT net.http_post(
    url:='https://cymdrkeukockakfzjeen.supabase.co/functions/v1/whatsapp-aquecimento',
    headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5bWRya2V1a29ja2FrZnpqZWVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNjI0OTQsImV4cCI6MjA4MTYzODQ5NH0.mjcAvZDXLA6m46JCR474jZDHOF2WmWUXygChA4z__2U"}'::jsonb,
    body:=concat('{"trigger":"cron-economico","time":"', now(), '"}')::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'aquecimento-promocao-fase-diaria',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url:='https://cymdrkeukockakfzjeen.supabase.co/functions/v1/aquecimento-promocao-fase',
    headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5bWRya2V1a29ja2FrZnpqZWVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNjI0OTQsImV4cCI6MjA4MTYzODQ5NH0.mjcAvZDXLA6m46JCR474jZDHOF2WmWUXygChA4z__2U"}'::jsonb,
    body:='{"trigger":"cron-diario"}'::jsonb
  ) AS request_id;
  $$
);