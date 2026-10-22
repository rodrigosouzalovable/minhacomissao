ALTER FUNCTION public.ume_carteira_gravar(text, date, jsonb, jsonb) SET statement_timeout = '120s';
ALTER FUNCTION public.ume_carteira_finalizar(text, date) SET statement_timeout = '120s';