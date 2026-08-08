select cron.alter_job(60, schedule := '0 13,16,20 * * 1-5');
select cron.alter_job(61, schedule := '30 22 * * 1-5');
select cron.alter_job(63, schedule := '50 12,15,19,22 * * 1-5');