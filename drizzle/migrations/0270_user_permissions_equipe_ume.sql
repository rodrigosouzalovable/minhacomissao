ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS equipe_ume text NOT NULL DEFAULT 'padrao';
ALTER TABLE public.user_permissions ADD CONSTRAINT user_permissions_equipe_ume_chk CHECK (equipe_ume IN ('padrao','amaral'));
UPDATE public.user_permissions SET equipe_ume = 'amaral' WHERE user_id = 'a3e72fe9-5522-42ce-a0ce-fc1113a45f20';

CREATE OR REPLACE FUNCTION public.admin_definir_equipe_ume(_user_id uuid, _equipe text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Apenas administradores'; END IF;
  IF _equipe NOT IN ('padrao','amaral') THEN RAISE EXCEPTION 'Equipe inválida'; END IF;
  INSERT INTO public.user_permissions (user_id, equipe_ume, concedido_por)
  VALUES (_user_id, _equipe, auth.uid())
  ON CONFLICT (user_id) DO UPDATE SET equipe_ume = EXCLUDED.equipe_ume, atualizado_em = now();
END $$;
REVOKE ALL ON FUNCTION public.admin_definir_equipe_ume(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_definir_equipe_ume(uuid, text) TO authenticated;