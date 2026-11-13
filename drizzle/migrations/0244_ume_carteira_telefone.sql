ALTER TABLE public.ume_carteira_clientes ADD COLUMN IF NOT EXISTS telefone text;
CREATE OR REPLACE FUNCTION public.ume_carteira_gravar_telefones(p_telefones jsonb)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' SET statement_timeout TO '120s'
AS $$
DECLARE v_n integer := 0;
BEGIN
  IF NOT public.sftp_ume_pode() THEN RAISE EXCEPTION 'Apenas administradores.' USING ERRCODE = '42501'; END IF;
  UPDATE ume_carteira_clientes c SET telefone = t.tel
  FROM (SELECT DISTINCT ON (public.cpf_normalize(x->>'cpf')) public.cpf_normalize(x->>'cpf') cpf, x->>'telefone' tel
        FROM jsonb_array_elements(coalesce(p_telefones,'[]'::jsonb)) x
        WHERE coalesce(x->>'telefone','') <> '') t
  WHERE c.cpf = t.cpf AND c.telefone IS DISTINCT FROM t.tel;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END $$;
REVOKE ALL ON FUNCTION public.ume_carteira_gravar_telefones(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ume_carteira_gravar_telefones(jsonb) TO authenticated, service_role;