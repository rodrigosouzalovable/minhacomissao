SELECT cron.schedule(
  'aquecimento-autosave-horario',
  '0 11-23 * * *',
  $$
  SELECT net.http_post(
    url:='https://cymdrkeukockakfzjeen.supabase.co/functions/v1/aquecimento-envio-autosave',
    headers:='{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5bWRya2V1a29ja2FrZnpqZWVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNjI0OTQsImV4cCI6MjA4MTYzODQ5NH0.mjcAvZDXLA6m46JCR474jZDHOF2WmWUXygChA4z__2U"}'::jsonb,
    body:=concat('{"trigger":"cron-horario","time":"', now(), '"}')::jsonb
  ) AS request_id;
  $$
);