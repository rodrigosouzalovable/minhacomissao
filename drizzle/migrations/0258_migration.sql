CREATE TABLE public.cliente_usa_config (
  user_id uuid PRIMARY KEY,
  usa_b2b boolean NOT NULL DEFAULT false,
  teste_ate timestamptz,
  prompt_ia text NOT NULL DEFAULT '',
  idioma text NOT NULL DEFAULT 'auto',
  ia_ativa boolean NOT NULL DEFAULT false,
  limite_respostas integer NOT NULL DEFAULT 200,
  respostas_usadas integer NOT NULL DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.cliente_usa_config TO authenticated;
GRANT ALL ON public.cliente_usa_config TO service_role;
ALTER TABLE public.cliente_usa_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dono ou admin le" ON public.cliente_usa_config FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "dono edita config ia" ON public.cliente_usa_config FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.cliente_usa_proteger_campos()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.role() = 'authenticated' AND NOT public.has_role(auth.uid(),'admin') THEN
    IF NEW.usa_b2b IS DISTINCT FROM OLD.usa_b2b OR NEW.teste_ate IS DISTINCT FROM OLD.teste_ate
       OR NEW.limite_respostas IS DISTINCT FROM OLD.limite_respostas OR NEW.respostas_usadas IS DISTINCT FROM OLD.respostas_usadas THEN
      RAISE EXCEPTION 'Campo restrito';
    END IF;
    IF NEW.idioma NOT IN ('auto','en','es','pt') OR length(NEW.prompt_ia) > 8000 THEN
      RAISE EXCEPTION 'Dados inválidos';
    END IF;
  END IF;
  NEW.atualizado_em := now();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_cliente_usa_proteger BEFORE UPDATE ON public.cliente_usa_config
FOR EACH ROW EXECUTE FUNCTION public.cliente_usa_proteger_campos();

CREATE OR REPLACE FUNCTION public.admin_definir_cliente_usa(_user_id uuid, _usa_b2b boolean, _teste boolean, _dias_extra integer DEFAULT 0)
RETURNS public.cliente_usa_config LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.cliente_usa_config;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Apenas admin'; END IF;
  INSERT INTO public.cliente_usa_config(user_id) VALUES (_user_id) ON CONFLICT (user_id) DO NOTHING;
  UPDATE public.cliente_usa_config SET
    usa_b2b = _usa_b2b,
    teste_ate = CASE
      WHEN NOT _teste THEN NULL
      WHEN _dias_extra > 0 THEN greatest(coalesce(teste_ate, now()), now()) + make_interval(days => _dias_extra)
      WHEN teste_ate IS NULL THEN now() + interval '3 days'
      ELSE teste_ate END,
    respostas_usadas = CASE WHEN _teste AND teste_ate IS NULL THEN 0 ELSE respostas_usadas END
  WHERE user_id = _user_id RETURNING * INTO r;
  IF _usa_b2b THEN
    INSERT INTO public.user_permissions(user_id, abas_permitidas) VALUES (_user_id, ARRAY['/cliente-usa','/inbox','/conta'])
    ON CONFLICT (user_id) DO UPDATE SET abas_permitidas = ARRAY['/cliente-usa','/inbox','/conta'], atualizado_em = now();
  END IF;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.admin_definir_cliente_usa(uuid,boolean,boolean,integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_definir_cliente_usa(uuid,boolean,boolean,integer) TO authenticated;