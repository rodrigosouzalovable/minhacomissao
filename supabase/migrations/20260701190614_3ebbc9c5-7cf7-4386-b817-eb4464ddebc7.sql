
-- =========================================================
-- 1) Ampliar RLS para inbox_compartilhado no Meta Inbox
-- =========================================================

-- meta_whatsapp_contatos
DROP POLICY IF EXISTS "owner can manage meta contatos" ON public.meta_whatsapp_contatos;
CREATE POLICY "meta_contatos_owner_or_admin_all"
  ON public.meta_whatsapp_contatos FOR ALL
  USING (auth.uid() = user_id OR public.is_admin_user(auth.uid()))
  WITH CHECK (auth.uid() = user_id OR public.is_admin_user(auth.uid()));
CREATE POLICY "meta_contatos_shared_select"
  ON public.meta_whatsapp_contatos FOR SELECT
  USING (public.has_inbox_compartilhado(auth.uid()));
CREATE POLICY "meta_contatos_shared_update"
  ON public.meta_whatsapp_contatos FOR UPDATE
  USING (public.has_inbox_compartilhado(auth.uid()))
  WITH CHECK (public.has_inbox_compartilhado(auth.uid()));

-- meta_whatsapp_mensagens
DROP POLICY IF EXISTS "owner can manage meta mensagens" ON public.meta_whatsapp_mensagens;
CREATE POLICY "meta_mensagens_owner_or_admin_all"
  ON public.meta_whatsapp_mensagens FOR ALL
  USING (auth.uid() = user_id OR public.is_admin_user(auth.uid()))
  WITH CHECK (auth.uid() = user_id OR public.is_admin_user(auth.uid()));
CREATE POLICY "meta_mensagens_shared_select"
  ON public.meta_whatsapp_mensagens FOR SELECT
  USING (public.has_inbox_compartilhado(auth.uid()));
CREATE POLICY "meta_mensagens_shared_insert"
  ON public.meta_whatsapp_mensagens FOR INSERT
  WITH CHECK (public.has_inbox_compartilhado(auth.uid()));

-- meta_whatsapp_instances
CREATE POLICY "meta_instances_shared_select"
  ON public.meta_whatsapp_instances FOR SELECT
  USING (public.has_inbox_compartilhado(auth.uid()));

-- meta_whatsapp_etiquetas: leitura compartilhada
CREATE POLICY "meta_etiquetas_shared_select"
  ON public.meta_whatsapp_etiquetas FOR SELECT
  USING (public.has_inbox_compartilhado(auth.uid()));

-- meta_whatsapp_contato_etiquetas: leitura + escrita compartilhada
CREATE POLICY "meta_contato_etiquetas_shared_select"
  ON public.meta_whatsapp_contato_etiquetas FOR SELECT
  USING (public.has_inbox_compartilhado(auth.uid()));
CREATE POLICY "meta_contato_etiquetas_shared_write"
  ON public.meta_whatsapp_contato_etiquetas FOR INSERT
  WITH CHECK (public.has_inbox_compartilhado(auth.uid()));
CREATE POLICY "meta_contato_etiquetas_shared_delete"
  ON public.meta_whatsapp_contato_etiquetas FOR DELETE
  USING (public.has_inbox_compartilhado(auth.uid()));

-- =========================================================
-- 2) Fila de atendimento
-- =========================================================

CREATE TABLE IF NOT EXISTS public.meta_atendimento_fila (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  ordem integer NOT NULL,
  etiqueta_id uuid,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.meta_atendimento_fila TO authenticated;
GRANT ALL ON public.meta_atendimento_fila TO service_role;
ALTER TABLE public.meta_atendimento_fila ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fila_read_authenticated" ON public.meta_atendimento_fila
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "fila_admin_write" ON public.meta_atendimento_fila
  FOR ALL USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

CREATE TABLE IF NOT EXISTS public.meta_atendimento_estado (
  id integer PRIMARY KEY,
  ultimo_index integer NOT NULL DEFAULT 0,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.meta_atendimento_estado TO authenticated;
GRANT ALL ON public.meta_atendimento_estado TO service_role;
ALTER TABLE public.meta_atendimento_estado ENABLE ROW LEVEL SECURITY;
CREATE POLICY "estado_read_authenticated" ON public.meta_atendimento_estado
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "estado_admin_write" ON public.meta_atendimento_estado
  FOR ALL USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

INSERT INTO public.meta_atendimento_estado (id, ultimo_index)
VALUES (1, 0) ON CONFLICT (id) DO NOTHING;

-- =========================================================
-- 3) Seed: 4 atendentes + 4 etiquetas (admin owner)
-- =========================================================
DO $$
DECLARE
  v_admin uuid := 'ee649720-b8ce-47a2-859e-100a3a9ae6bb';
  v_rec record;
  v_etid uuid;
  v_users jsonb := jsonb_build_array(
    jsonb_build_object('user_id','bb6a930c-c5e7-45c1-ab27-3cc4e63539f5','nome','Anna Flavia','ordem',1,'cor','#25D366'),
    jsonb_build_object('user_id','00dcf300-277c-4363-988b-5238dc6f6a0a','nome','Yasmim','ordem',2,'cor','#6C5CE7'),
    jsonb_build_object('user_id','30a8f5f1-a8ce-430e-957b-9eae7fe0ddd6','nome','Fernanda','ordem',3,'cor','#FF8A5C'),
    jsonb_build_object('user_id','8bb83af2-4020-48aa-b999-dcf4ee2f7c70','nome','Wallace','ordem',4,'cor','#00B4D8')
  );
BEGIN
  FOR v_rec IN SELECT * FROM jsonb_to_recordset(v_users) AS x(user_id uuid, nome text, ordem int, cor text)
  LOOP
    -- Cria etiqueta se ainda não existir
    SELECT id INTO v_etid
    FROM public.meta_whatsapp_etiquetas
    WHERE user_id = v_admin AND nome = 'Atendente: ' || v_rec.nome
    LIMIT 1;

    IF v_etid IS NULL THEN
      INSERT INTO public.meta_whatsapp_etiquetas (user_id, nome, cor)
      VALUES (v_admin, 'Atendente: ' || v_rec.nome, v_rec.cor)
      RETURNING id INTO v_etid;
    END IF;

    INSERT INTO public.meta_atendimento_fila (user_id, ordem, etiqueta_id, ativo)
    VALUES (v_rec.user_id, v_rec.ordem, v_etid, true)
    ON CONFLICT (user_id) DO UPDATE
      SET ordem = EXCLUDED.ordem,
          etiqueta_id = EXCLUDED.etiqueta_id,
          ativo = true;
  END LOOP;
END $$;

-- =========================================================
-- 4) Trigger de atribuição round-robin
-- =========================================================
CREATE OR REPLACE FUNCTION public.atribuir_atendente_fila()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contato_id uuid;
  v_ja_atribuido boolean;
  v_total int;
  v_next int;
  v_fila record;
BEGIN
  IF NEW.direcao <> 'entrada' THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_contato_id
  FROM public.meta_whatsapp_contatos
  WHERE instancia_id = NEW.instancia_id
    AND telefone = NEW.telefone
  LIMIT 1;

  IF v_contato_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS(
    SELECT 1
    FROM public.meta_whatsapp_contato_etiquetas ce
    JOIN public.meta_atendimento_fila f ON f.etiqueta_id = ce.etiqueta_id
    WHERE ce.contato_id = v_contato_id
  ) INTO v_ja_atribuido;

  IF v_ja_atribuido THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_total FROM public.meta_atendimento_fila WHERE ativo = true;
  IF v_total = 0 THEN RETURN NEW; END IF;

  UPDATE public.meta_atendimento_estado
     SET ultimo_index = ((ultimo_index) % v_total) + 1,
         atualizado_em = now()
   WHERE id = 1
   RETURNING ultimo_index INTO v_next;

  SELECT * INTO v_fila
  FROM public.meta_atendimento_fila
  WHERE ativo = true
  ORDER BY ordem
  OFFSET (v_next - 1) LIMIT 1;

  IF v_fila.etiqueta_id IS NOT NULL THEN
    INSERT INTO public.meta_whatsapp_contato_etiquetas (contato_id, etiqueta_id)
    VALUES (v_contato_id, v_fila.etiqueta_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_atribuir_atendente_fila ON public.meta_whatsapp_mensagens;
CREATE TRIGGER trg_atribuir_atendente_fila
AFTER INSERT ON public.meta_whatsapp_mensagens
FOR EACH ROW EXECUTE FUNCTION public.atribuir_atendente_fila();
