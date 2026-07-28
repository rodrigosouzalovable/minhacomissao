
-- 1) Helper: sufixo dos últimos 8 dígitos de um telefone
CREATE OR REPLACE FUNCTION public.phone_suffix8(tel text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN tel IS NULL THEN NULL
    WHEN LENGTH(REGEXP_REPLACE(tel, '\D', '', 'g')) >= 8
      THEN RIGHT(REGEXP_REPLACE(tel, '\D', '', 'g'), 8)
    ELSE NULL
  END;
$$;

-- 2) Merge de contatos duplicados por (instancia_id, sufixo)
DO $$
DECLARE
  grp RECORD;
  canonical RECORD;
  dup RECORD;
BEGIN
  FOR grp IN
    SELECT instancia_id, public.phone_suffix8(telefone) AS suf
    FROM public.meta_whatsapp_contatos
    WHERE public.phone_suffix8(telefone) IS NOT NULL
    GROUP BY 1, 2
    HAVING COUNT(*) > 1
  LOOP
    -- canônico: contato com entrada mais recente; empate → mais antigo criado
    SELECT * INTO canonical
    FROM public.meta_whatsapp_contatos
    WHERE instancia_id = grp.instancia_id
      AND public.phone_suffix8(telefone) = grp.suf
    ORDER BY ultima_msg_entrada_em DESC NULLS LAST, criado_em ASC
    LIMIT 1;

    FOR dup IN
      SELECT * FROM public.meta_whatsapp_contatos
      WHERE instancia_id = grp.instancia_id
        AND public.phone_suffix8(telefone) = grp.suf
        AND id <> canonical.id
    LOOP
      -- Reaponta mensagens
      UPDATE public.meta_whatsapp_mensagens
        SET telefone = canonical.telefone
        WHERE instancia_id = dup.instancia_id AND telefone = dup.telefone;

      -- Envios log
      UPDATE public.meta_whatsapp_envios_log
        SET telefone = canonical.telefone
        WHERE instancia_id = dup.instancia_id AND telefone = dup.telefone;

      -- Fila e lembretes
      UPDATE public.meta_envios_fila
        SET telefone = canonical.telefone
        WHERE instancia_id = dup.instancia_id AND telefone = dup.telefone;
      UPDATE public.meta_lembrete_log
        SET telefone = canonical.telefone
        WHERE instancia_id = dup.instancia_id AND telefone = dup.telefone;

      -- Etiquetas: reaponta contato_id, evitando duplicatas
      UPDATE public.meta_whatsapp_contato_etiquetas e
        SET contato_id = canonical.id
        WHERE e.contato_id = dup.id
          AND NOT EXISTS (
            SELECT 1 FROM public.meta_whatsapp_contato_etiquetas e2
            WHERE e2.contato_id = canonical.id AND e2.etiqueta_id = e.etiqueta_id
          );
      DELETE FROM public.meta_whatsapp_contato_etiquetas WHERE contato_id = dup.id;

      -- Agrega campos no canônico
      UPDATE public.meta_whatsapp_contatos
        SET
          nome = COALESCE(NULLIF(canonical.nome, ''), dup.nome),
          folder_id = COALESCE(canonical.folder_id, dup.folder_id),
          nao_lido = COALESCE(canonical.nao_lido, 0) + COALESCE(dup.nao_lido, 0),
          ultima_msg_entrada_em = GREATEST(
            COALESCE(canonical.ultima_msg_entrada_em, 'epoch'::timestamptz),
            COALESCE(dup.ultima_msg_entrada_em, 'epoch'::timestamptz)
          ),
          ultima_mensagem_em = GREATEST(
            COALESCE(canonical.ultima_mensagem_em, 'epoch'::timestamptz),
            COALESCE(dup.ultima_mensagem_em, 'epoch'::timestamptz)
          ),
          arquivado = COALESCE(canonical.arquivado, false) OR COALESCE(dup.arquivado, false),
          bsuid = COALESCE(canonical.bsuid, dup.bsuid),
          whatsapp_username = COALESCE(canonical.whatsapp_username, dup.whatsapp_username),
          atualizado_em = now()
        WHERE id = canonical.id;

      -- Apaga duplicado
      DELETE FROM public.meta_whatsapp_contatos WHERE id = dup.id;
    END LOOP;
  END LOOP;
END $$;

-- 3) Índice para acelerar lookup por sufixo
CREATE INDEX IF NOT EXISTS idx_meta_contatos_instancia_suffix
  ON public.meta_whatsapp_contatos (instancia_id, public.phone_suffix8(telefone));
CREATE INDEX IF NOT EXISTS idx_meta_mensagens_instancia_suffix
  ON public.meta_whatsapp_mensagens (instancia_id, public.phone_suffix8(telefone));
