ALTER TABLE public.iago_config ALTER COLUMN ume_tabela SET DEFAULT 'sem_juros_10';
UPDATE public.iago_config SET ume_tabela = 'sem_juros_10';