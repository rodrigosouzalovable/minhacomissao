-- Evita duplicidade caso este ajuste seja reaplicado.
DO $$
DECLARE
  v_job_id bigint;
BEGIN
  FOR v_job_id IN
    SELECT jobid FROM cron.job WHERE jobname = 'meta-recuperacao-tick-10min'
  LOOP
    PERFORM cron.unschedule(v_job_id);
  END LOOP;
END $$;

-- Reativa a recuperação apenas para instâncias próprias Meta RED/YELLOW.
UPDATE public.meta_whatsapp_instances
SET
  recuperacao_ativa = true,
  recuperacao_desde = COALESCE(recuperacao_desde, now()),
  recuperacao_msgs_meta_dia = NULL,
  recuperacao_proximo_envio_em = now()
WHERE ativo = true
  AND provider = 'meta'
  AND aquecimento_qualidade_permitido = true
  AND upper(COALESCE(saude_quality, '')) IN ('RED', 'YELLOW')
  AND upper(COALESCE(saude_status, 'CONNECTED')) NOT IN ('BANNED', 'FLAGGED', 'RESTRICTED');

-- Executa a cada 10 minutos; a própria função aplica a janela, domingo,
-- limites de volume, intervalo e bloqueios de envio.
SELECT cron.schedule(
  'meta-recuperacao-tick-10min',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://cymdrkeukockakfzjeen.supabase.co/functions/v1/meta-recuperacao-tick',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5bWRya2V1a29ja2FrZnpqZWVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNjI0OTQsImV4cCI6MjA4MTYzODQ5NH0.mjcAvZDXLA6m46JCR474jZDHOF2WmWUXygChA4z__2U"}'::jsonb,
    body := '{"trigger":"cron"}'::jsonb
  );
  $$
);