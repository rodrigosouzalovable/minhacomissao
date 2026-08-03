CREATE TABLE IF NOT EXISTS public.meta_inbox_default_members (
  user_id uuid PRIMARY KEY,
  criado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_inbox_default_members TO authenticated;
GRANT ALL ON public.meta_inbox_default_members TO service_role;

ALTER TABLE public.meta_inbox_default_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "default members self select"
  ON public.meta_inbox_default_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "default members admin manage"
  ON public.meta_inbox_default_members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.meta_inbox_default_members (user_id)
SELECT p.id FROM public.profiles p
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.can_access_meta_inbox_default(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _uid IS NOT NULL AND (
    public.has_role(_uid, 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.meta_inbox_default_members m WHERE m.user_id = _uid
    )
  )
$$;

CREATE OR REPLACE FUNCTION public.can_view_meta_contato_folder(_uid uuid, _folder uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    public.has_role(_uid, 'admin'::app_role)
    OR CASE
      WHEN _folder IS NULL THEN public.can_access_meta_inbox_default(_uid)
      ELSE public.can_access_meta_folder(_uid, _folder)
    END
$$;

DROP POLICY IF EXISTS meta_contatos_folder_restrict ON public.meta_whatsapp_contatos;

CREATE POLICY meta_contatos_folder_restrict
  ON public.meta_whatsapp_contatos AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.can_view_meta_contato_folder(auth.uid(), folder_id))
  WITH CHECK (public.can_view_meta_contato_folder(auth.uid(), folder_id));