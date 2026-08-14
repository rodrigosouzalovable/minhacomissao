CREATE TABLE IF NOT EXISTS public.pix_links (
  id text PRIMARY KEY,
  codigo text NOT NULL,
  telefone text,
  instancia_id uuid,
  user_id uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  expira_em timestamptz NOT NULL DEFAULT now() + interval '7 days'
);

GRANT SELECT, INSERT ON public.pix_links TO authenticated;
GRANT ALL ON public.pix_links TO service_role;

ALTER TABLE public.pix_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pix_links_insert_auth" ON public.pix_links;
CREATE POLICY "pix_links_insert_auth" ON public.pix_links
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "pix_links_select_auth" ON public.pix_links;
CREATE POLICY "pix_links_select_auth" ON public.pix_links
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.get_pix_link(p_id text)
RETURNS TABLE (codigo text, criado_em timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.codigo, p.criado_em
  FROM public.pix_links p
  WHERE p.id = p_id AND p.expira_em > now()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_pix_link(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.limpar_pix_links_expirados()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  DELETE FROM public.pix_links WHERE expira_em < now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;