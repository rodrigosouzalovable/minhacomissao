CREATE OR REPLACE FUNCTION public.sftp_ume_vincular_existentes(p_arquivo uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; v_acordo record; v_pid uuid; v_val numeric; v_dp date; v_ref date; v_n integer := 0;
BEGIN
  IF NOT public.sftp_ume_pode() THEN RAISE EXCEPTION 'Apenas administradores.' USING ERRCODE = '42501'; END IF;
  FOR r IN SELECT b.*, a.data_lote FROM sftp_ume_baixas b JOIN sftp_ume_arquivos a ON a.id = b.arquivo_id
           WHERE b.arquivo_id = p_arquivo AND b.status = 'sem_acordo' LOOP
    v_val := coalesce(r.valor_pago, r.valor);
    v_dp := coalesce(r.data_pagamento, r.data_lote, current_date);
    v_ref := coalesce(r.vencimento, v_dp);
    IF v_val IS NULL OR v_val <= 0 THEN CONTINUE; END IF;
    SELECT * INTO v_acordo FROM acordos ac
      WHERE public.cpf_normalize(ac.cliente_cpf) = public.cpf_normalize(r.cpf) AND ac.status = 'ativo'
        AND ac.empresa IN ('mundo_da_moda','odres_cred','ume_novo_mundo')
      ORDER BY ac.criado_em DESC LIMIT 1;
    IF NOT FOUND THEN CONTINUE; END IF;
    -- Os arquivos são snapshots: o mesmo pagamento reaparece; nunca lançar duas vezes.
    IF EXISTS (SELECT 1 FROM sftp_ume_baixas o WHERE o.id <> r.id AND o.status IN ('aplicado','ja_pago')
                 AND o.cpf = r.cpf AND coalesce(o.contrato,'') = coalesce(r.contrato,'')
                 AND coalesce(o.data_pagamento, v_dp) = v_dp)
       OR EXISTS (SELECT 1 FROM pagamentos p WHERE p.acordo_id = v_acordo.id AND p.status = 'pago'
                 AND abs(p.valor_parcela - v_val) <= 1 AND p.data_paga BETWEEN v_dp - 5 AND v_dp + 5) THEN
      UPDATE sftp_ume_baixas SET status = 'ja_pago', acordo_id = v_acordo.id, aplicado_em = now() WHERE id = r.id;
      CONTINUE;
    END IF;
    SELECT p.id INTO v_pid FROM pagamentos p
      WHERE p.acordo_id = v_acordo.id AND p.status = 'pendente' AND p.data_prevista BETWEEN v_ref - 35 AND v_ref + 35
      ORDER BY abs(p.data_prevista - v_ref) LIMIT 1;
    IF v_pid IS NOT NULL THEN
      UPDATE pagamentos SET status = 'pago', data_paga = v_dp, valor_parcela = v_val,
        comissao_parcela = round(v_val * coalesce(v_acordo.percentual_comissao,0) / 100.0, 2)
      WHERE id = v_pid;
    ELSE
      INSERT INTO pagamentos(acordo_id, numero_parcela, data_prevista, data_paga, valor_parcela, comissao_parcela, status)
      VALUES (v_acordo.id, coalesce((SELECT max(numero_parcela) FROM pagamentos WHERE acordo_id = v_acordo.id),0) + 1,
        v_ref, v_dp, v_val, round(v_val * coalesce(v_acordo.percentual_comissao,0) / 100.0, 2), 'pago')
      RETURNING id INTO v_pid;
    END IF;
    UPDATE acordos ac SET valor_total = s.tot, parcelas = s.qtd, comissao_total = s.com, atualizado_em = now()
      FROM (SELECT sum(valor_parcela) tot, count(*) qtd, sum(comissao_parcela) com FROM pagamentos WHERE acordo_id = v_acordo.id) s
      WHERE ac.id = v_acordo.id;
    UPDATE sftp_ume_baixas SET status = 'aplicado', acordo_id = v_acordo.id, pagamento_id = v_pid, aplicado_em = now() WHERE id = r.id;
    v_n := v_n + 1;
  END LOOP;
  UPDATE sftp_ume_arquivos SET aplicadas = (SELECT count(*) FROM sftp_ume_baixas WHERE arquivo_id = p_arquivo AND status = 'aplicado') WHERE id = p_arquivo;
  RETURN v_n;
END $$;
REVOKE ALL ON FUNCTION public.sftp_ume_vincular_existentes(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.sftp_ume_vincular_existentes(uuid) TO authenticated, service_role;