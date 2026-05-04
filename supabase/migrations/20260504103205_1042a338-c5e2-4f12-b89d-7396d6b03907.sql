-- EMERGÊNCIA DE CUSTO: remove todos os crons automáticos custosos via cron.unschedule
SELECT cron.unschedule('ai-budget-monitor-30min');
SELECT cron.unschedule('aquecimento-auto-diario');
SELECT cron.unschedule('aquecimento-autosave-horario');
SELECT cron.unschedule('aquecimento-promocao-fase-diaria');
SELECT cron.unschedule('daily-report-aquecimento-20h');
SELECT cron.unschedule('daily-whatsapp-report');
SELECT cron.unschedule('process-whatsapp-queue-10min');
SELECT cron.unschedule('process-acionamento-agendado-v2');
SELECT cron.unschedule('check-reminders-daily-0920');
SELECT cron.unschedule('cleanup-inbox-media-daily');
SELECT cron.unschedule('cleanup-acordos-diario');
SELECT cron.unschedule('credor-report-semanal');
SELECT cron.unschedule('credor-report-mensal');