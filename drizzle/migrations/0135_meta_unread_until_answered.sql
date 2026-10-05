ALTER TABLE public.meta_whatsapp_contatos
  ADD COLUMN IF NOT EXISTS ultima_msg_saida_em timestamptz NULL;

COMMENT ON COLUMN public.meta_whatsapp_contatos.ultima_msg_saida_em IS
  'Horário da saída mais recente usada para manter nao_lido até existir resposta posterior à entrada.';

CREATE OR REPLACE FUNCTION public.incrementar_meta_contato_nao_lido(
  _contato_id uuid,
  _entrada_em timestamptz
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _novo_total integer;
BEGIN
  UPDATE public.meta_whatsapp_contatos
  SET nao_lido = CASE
        WHEN ultima_msg_saida_em IS NOT NULL AND ultima_msg_saida_em >= _entrada_em
          THEN nao_lido
        ELSE COALESCE(nao_lido, 0) + 1
      END,
      ultima_msg_entrada_em = GREATEST(COALESCE(ultima_msg_entrada_em, _entrada_em), _entrada_em),
      ultima_interacao_em = GREATEST(COALESCE(ultima_interacao_em, _entrada_em), _entrada_em),
      atualizado_em = GREATEST(COALESCE(atualizado_em, _entrada_em), _entrada_em)
  WHERE id = _contato_id
  RETURNING nao_lido INTO _novo_total;

  RETURN _novo_total;
END;
$$;

REVOKE ALL ON FUNCTION public.incrementar_meta_contato_nao_lido(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.incrementar_meta_contato_nao_lido(uuid, timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.meta_concluir_nao_lido_apos_saida()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.direcao <> 'saida' OR NEW.status_envio = 'erro' THEN
    RETURN NEW;
  END IF;

  UPDATE public.meta_whatsapp_contatos AS c
  SET ultima_msg_saida_em = GREATEST(COALESCE(c.ultima_msg_saida_em, NEW.timestamp_msg), NEW.timestamp_msg),
      nao_lido = CASE
        WHEN c.ultima_msg_entrada_em IS NULL OR NEW.timestamp_msg >= c.ultima_msg_entrada_em THEN 0
        ELSE c.nao_lido
      END,
      atualizado_em = GREATEST(COALESCE(c.atualizado_em, NEW.timestamp_msg), NEW.timestamp_msg)
  WHERE c.instancia_id = NEW.instancia_id
    AND (
      (NEW.bsuid IS NOT NULL AND c.bsuid = NEW.bsuid)
      OR (
        NEW.telefone IS NOT NULL
        AND public.phone_suffix8(c.telefone) = public.phone_suffix8(NEW.telefone)
      )
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_meta_concluir_nao_lido_apos_saida ON public.meta_whatsapp_mensagens;
CREATE TRIGGER trg_meta_concluir_nao_lido_apos_saida
AFTER INSERT ON public.meta_whatsapp_mensagens
FOR EACH ROW
EXECUTE FUNCTION public.meta_concluir_nao_lido_apos_saida();