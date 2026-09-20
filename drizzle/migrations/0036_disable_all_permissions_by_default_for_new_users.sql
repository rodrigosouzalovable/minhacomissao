ALTER TABLE public.user_permissions ALTER COLUMN abas_permitidas SET DEFAULT ARRAY[]::text[];
ALTER TABLE public.user_permissions ALTER COLUMN credores SET DEFAULT ARRAY[]::text[];
ALTER TABLE public.user_permissions ALTER COLUMN visivel_ranking SET DEFAULT false;
ALTER TABLE public.user_permissions ALTER COLUMN atende_inbox_meta SET DEFAULT false;