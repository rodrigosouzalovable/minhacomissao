
ALTER TABLE public.meta_whatsapp_contato_etiquetas
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'manual';

ALTER TABLE public.meta_whatsapp_contato_etiquetas
  DROP CONSTRAINT IF EXISTS meta_contato_etiquetas_origem_chk;
ALTER TABLE public.meta_whatsapp_contato_etiquetas
  ADD CONSTRAINT meta_contato_etiquetas_origem_chk
  CHECK (origem IN ('manual', 'auto_atendente'));

DROP POLICY IF EXISTS meta_contato_etiquetas_shared_delete ON public.meta_whatsapp_contato_etiquetas;
CREATE POLICY meta_contato_etiquetas_shared_delete
  ON public.meta_whatsapp_contato_etiquetas
  FOR DELETE
  USING (
    has_inbox_compartilhado(auth.uid())
    AND (origem <> 'auto_atendente' OR is_admin_user(auth.uid()))
  );

DROP POLICY IF EXISTS meta_contato_etiquetas_owner_all ON public.meta_whatsapp_contato_etiquetas;
CREATE POLICY meta_contato_etiquetas_owner_select
  ON public.meta_whatsapp_contato_etiquetas
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.meta_whatsapp_etiquetas e
    WHERE e.id = meta_whatsapp_contato_etiquetas.etiqueta_id
      AND e.user_id = auth.uid()
  ));
CREATE POLICY meta_contato_etiquetas_owner_insert
  ON public.meta_whatsapp_contato_etiquetas
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.meta_whatsapp_etiquetas e
    WHERE e.id = meta_whatsapp_contato_etiquetas.etiqueta_id
      AND e.user_id = auth.uid()
  ));
CREATE POLICY meta_contato_etiquetas_owner_update
  ON public.meta_whatsapp_contato_etiquetas
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.meta_whatsapp_etiquetas e
    WHERE e.id = meta_whatsapp_contato_etiquetas.etiqueta_id
      AND e.user_id = auth.uid()
  ));
CREATE POLICY meta_contato_etiquetas_owner_delete
  ON public.meta_whatsapp_contato_etiquetas
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.meta_whatsapp_etiquetas e
      WHERE e.id = meta_whatsapp_contato_etiquetas.etiqueta_id
        AND e.user_id = auth.uid()
    )
    AND (origem <> 'auto_atendente' OR is_admin_user(auth.uid()))
  );

DROP POLICY IF EXISTS meta_etiquetas_owner_all ON public.meta_whatsapp_etiquetas;
CREATE POLICY meta_etiquetas_owner_select
  ON public.meta_whatsapp_etiquetas FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY meta_etiquetas_owner_insert
  ON public.meta_whatsapp_etiquetas FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY meta_etiquetas_owner_update
  ON public.meta_whatsapp_etiquetas FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY meta_etiquetas_owner_delete
  ON public.meta_whatsapp_etiquetas FOR DELETE
  USING (
    auth.uid() = user_id
    AND (
      is_admin_user(auth.uid())
      OR NOT EXISTS (
        SELECT 1 FROM public.meta_whatsapp_contato_etiquetas ce
        WHERE ce.etiqueta_id = meta_whatsapp_etiquetas.id
          AND ce.origem = 'auto_atendente'
      )
    )
  );

DO $$
DECLARE
  r RECORD;
  v_etiqueta_id uuid;
  v_atendente_nome text;
  v_nome_etiqueta text;
BEGIN
  FOR r IN
    SELECT DISTINCT ON (c.id)
      c.id            AS contato_id,
      c.user_id       AS dono_id,
      a.user_id       AS atendente_id,
      p.nome          AS atendente_nome
    FROM public.meta_whatsapp_contatos c
    JOIN public.acordos a
      ON right(regexp_replace(coalesce(a.cliente_telefone,''), '\D','','g'), 8)
       = right(regexp_replace(coalesce(c.telefone,''),         '\D','','g'), 8)
     AND length(regexp_replace(coalesce(c.telefone,''),'\D','','g')) >= 8
    JOIN public.profiles p ON p.id = a.user_id
    WHERE c.telefone IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.meta_whatsapp_contato_etiquetas ce
        WHERE ce.contato_id = c.id AND ce.origem = 'auto_atendente'
      )
    ORDER BY c.id, a.criado_em DESC
  LOOP
    v_atendente_nome := coalesce(nullif(trim(r.atendente_nome), ''), 'Desconhecido');
    v_nome_etiqueta := 'Atendente: ' || v_atendente_nome;

    SELECT id INTO v_etiqueta_id
      FROM public.meta_whatsapp_etiquetas
     WHERE user_id = r.dono_id AND lower(nome) = lower(v_nome_etiqueta)
     LIMIT 1;

    IF v_etiqueta_id IS NULL THEN
      INSERT INTO public.meta_whatsapp_etiquetas (user_id, nome, cor)
      VALUES (r.dono_id, v_nome_etiqueta, '#25D366')
      RETURNING id INTO v_etiqueta_id;
    END IF;

    INSERT INTO public.meta_whatsapp_contato_etiquetas (contato_id, etiqueta_id, origem)
    VALUES (r.contato_id, v_etiqueta_id, 'auto_atendente')
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
