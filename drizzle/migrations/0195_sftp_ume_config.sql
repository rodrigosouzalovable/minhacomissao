CREATE TABLE public.sftp_ume_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  private_key text NOT NULL,
  atualizado_por uuid,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.sftp_ume_config TO service_role;
ALTER TABLE public.sftp_ume_config ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.sftp_ume_salvar_chave(p_chave text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas administradores.' USING ERRCODE = '42501';
  END IF;
  IF p_chave !~ 'BEGIN [A-Z ]*PRIVATE KEY' THEN
    RAISE EXCEPTION 'Arquivo de chave inválido.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO sftp_ume_config(id, private_key, atualizado_por, atualizado_em)
  VALUES (true, p_chave, auth.uid(), now())
  ON CONFLICT (id) DO UPDATE SET private_key = EXCLUDED.private_key, atualizado_por = EXCLUDED.atualizado_por, atualizado_em = now();
END $$;
REVOKE ALL ON FUNCTION public.sftp_ume_salvar_chave(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.sftp_ume_salvar_chave(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.sftp_ume_chave_status()
RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT atualizado_em FROM sftp_ume_config WHERE public.has_role(auth.uid(), 'admin'::public.app_role)
$$;
REVOKE ALL ON FUNCTION public.sftp_ume_chave_status() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.sftp_ume_chave_status() TO authenticated;