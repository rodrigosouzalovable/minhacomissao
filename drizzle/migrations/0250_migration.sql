CREATE TABLE public.meta_envio_diario_telefone (
  dia date NOT NULL,
  sufixo text NOT NULL,
  instancia_id uuid,
  template_nome text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (dia, sufixo)
);
GRANT ALL ON public.meta_envio_diario_telefone TO service_role;
GRANT SELECT ON public.meta_envio_diario_telefone TO authenticated;
ALTER TABLE public.meta_envio_diario_telefone ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff le trava diaria" ON public.meta_envio_diario_telefone FOR SELECT TO authenticated USING (public.is_staff_member((SELECT auth.uid())));

CREATE OR REPLACE FUNCTION public.reservar_envio_diario_telefone(p_telefone text, p_instancia uuid, p_template text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_suf text := right(regexp_replace(coalesce(p_telefone,''), '\D', '', 'g'), 8);
        v_dia date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
        v_ok boolean;
BEGIN
  IF length(v_suf) < 8 THEN RETURN true; END IF;
  DELETE FROM meta_envio_diario_telefone WHERE dia < v_dia - 7 AND random() < 0.01;
  INSERT INTO meta_envio_diario_telefone(dia, sufixo, instancia_id, template_nome)
  VALUES (v_dia, v_suf, p_instancia, p_template) ON CONFLICT DO NOTHING RETURNING true INTO v_ok;
  RETURN coalesce(v_ok, false);
END $$;

CREATE OR REPLACE FUNCTION public.liberar_envio_diario_telefone(p_telefone text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM meta_envio_diario_telefone
  WHERE dia = (now() AT TIME ZONE 'America/Sao_Paulo')::date
    AND sufixo = right(regexp_replace(coalesce(p_telefone,''), '\D', '', 'g'), 8);
$$;
REVOKE ALL ON FUNCTION public.reservar_envio_diario_telefone(text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.liberar_envio_diario_telefone(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reservar_envio_diario_telefone(text, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.liberar_envio_diario_telefone(text) TO service_role;