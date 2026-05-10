
SELECT cron.schedule(
  'aquecimento-perfil-completar-diario',
  '30 14 * * 1-6',
  $$
  SELECT net.http_post(
    url := 'https://cymdrkeukockakfzjeen.supabase.co/functions/v1/aquecimento-perfil-completar',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5bWRya2V1a29ja2FrZnpqZWVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNjI0OTQsImV4cCI6MjA4MTYzODQ5NH0.mjcAvZDXLA6m46JCR474jZDHOF2WmWUXygChA4z__2U"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
