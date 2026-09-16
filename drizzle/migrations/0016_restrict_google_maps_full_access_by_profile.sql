CREATE OR REPLACE FUNCTION public.pode_google_maps_leads(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
      OR public.is_parceiro_meta(_user_id)
$$;