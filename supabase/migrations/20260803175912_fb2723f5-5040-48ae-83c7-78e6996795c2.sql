ALTER TABLE public.user_permissions
  ADD COLUMN IF NOT EXISTS atende_inbox_meta boolean NOT NULL DEFAULT true;

UPDATE public.user_permissions up
SET atende_inbox_meta = false
WHERE EXISTS (
  SELECT 1 FROM public.profiles p
  WHERE p.id = up.user_id
    AND lower(trim(p.nome)) = 'thailinny nolasco'
);