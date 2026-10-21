CREATE OR REPLACE FUNCTION public.sftp_ume_aplicar(p_arquivo uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_n integer;
BEGIN
  IF NOT public.sftp_ume_pode() THEN
    RAISE EXCEPTION 'Apenas administradores.' USING ERRCODE = '42501';
  END IF;
  WITH alvo AS (
    SELECT DISTINCT ON (b.pagamento_id) b.id, b.pagamento_id, coalesce(b.data_pagamento, a.data_lote, current_date) dp
    FROM sftp_ume_baixas b JOIN sftp_ume_arquivos a ON a.id = b.arquivo_id
    WHERE b.arquivo_id = p_arquivo AND b.status = 'casado'
  ), upd AS (
    UPDATE pagamentos p SET status = 'pago', data_paga = alvo.dp
    FROM alvo WHERE p.id = alvo.pagamento_id AND p.status = 'pendente'
    RETURNING p.id
  )
  UPDATE sftp_ume_baixas b SET status = CASE WHEN b.pagamento_id IN (SELECT id FROM upd) THEN 'aplicado' ELSE 'ja_pago' END,
    aplicado_em = now()
  WHERE b.arquivo_id = p_arquivo AND b.status = 'casado';
  SELECT count(*) INTO v_n FROM sftp_ume_baixas WHERE arquivo_id = p_arquivo AND status = 'aplicado';
  UPDATE sftp_ume_arquivos SET aplicadas = v_n, casadas = 0, status = 'aplicado' WHERE id = p_arquivo;
  RETURN v_n;
END $$;