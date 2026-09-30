ALTER TABLE public.devedores
  ADD COLUMN IF NOT EXISTS cobmais_chave text,
  ADD COLUMN IF NOT EXISTS cobmais_status text,
  ADD COLUMN IF NOT EXISTS cobmais_atualizado_em timestamptz,
  ADD COLUMN IF NOT EXISTS cobmais_acordo_detectado boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_devedores_cobmais_chave
  ON public.devedores (cobmais_chave)
  WHERE cobmais_chave IS NOT NULL;

CREATE TABLE public.cobmais_importacoes_diarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_arquivo text NOT NULL,
  tamanho_bytes bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'validando' CHECK (status IN ('validando','enviando','publicando','concluido','erro')),
  total_linhas integer NOT NULL DEFAULT 0,
  total_parcelas integer NOT NULL DEFAULT 0,
  linhas_repetidas integer NOT NULL DEFAULT 0,
  conflitos integer NOT NULL DEFAULT 0,
  registros_processados integer NOT NULL DEFAULT 0,
  inseridos integer NOT NULL DEFAULT 0,
  atualizados integer NOT NULL DEFAULT 0,
  pagos integer NOT NULL DEFAULT 0,
  ausentes_baixados integer NOT NULL DEFAULT 0,
  erro_mensagem text,
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  concluido_em timestamptz,
  importado_por uuid NOT NULL DEFAULT auth.uid()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cobmais_importacoes_diarias TO authenticated;
GRANT ALL ON public.cobmais_importacoes_diarias TO service_role;
ALTER TABLE public.cobmais_importacoes_diarias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins gerenciam importacoes diarias Cobmais"
  ON public.cobmais_importacoes_diarias FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE public.cobmais_importacao_stage (
  run_id uuid NOT NULL REFERENCES public.cobmais_importacoes_diarias(id) ON DELETE CASCADE,
  source_key text NOT NULL,
  cpf text NOT NULL,
  nome text NOT NULL,
  credor text NOT NULL,
  contrato text NOT NULL,
  numero_parcela text NOT NULL,
  vencimento date,
  valor numeric NOT NULL DEFAULT 0,
  observacao text,
  status text,
  PRIMARY KEY (run_id, source_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cobmais_importacao_stage TO authenticated;
GRANT ALL ON public.cobmais_importacao_stage TO service_role;
ALTER TABLE public.cobmais_importacao_stage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins gerenciam stage diario Cobmais"
  ON public.cobmais_importacao_stage FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX idx_cobmais_stage_run_cpf ON public.cobmais_importacao_stage (run_id, cpf);

CREATE OR REPLACE FUNCTION public.publicar_importacao_cobmais_diaria(p_run_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run public.cobmais_importacoes_diarias%ROWTYPE;
  v_stage_count integer;
  v_previous_count integer;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_paid integer := 0;
  v_absent integer := 0;
  v_importacao_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem publicar a carteira Cobmais';
  END IF;

  SELECT * INTO v_run
  FROM public.cobmais_importacoes_diarias
  WHERE id = p_run_id AND importado_por = auth.uid()
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Importação não encontrada'; END IF;
  IF v_run.status = 'concluido' THEN RAISE EXCEPTION 'Importação já concluída'; END IF;

  SELECT count(*) INTO v_stage_count FROM public.cobmais_importacao_stage WHERE run_id = p_run_id;
  IF v_stage_count = 0 OR v_stage_count <> v_run.total_parcelas THEN
    RAISE EXCEPTION 'Arquivo incompleto: esperado %, recebido %', v_run.total_parcelas, v_stage_count;
  END IF;

  SELECT count(*) INTO v_previous_count
  FROM public.devedores
  WHERE credor IN ('ume_novo_mundo', 'ume_novo_mundo_aporte');
  IF v_previous_count > 0 AND v_stage_count < greatest(1000, floor(v_previous_count * 0.70)) THEN
    RAISE EXCEPTION 'Arquivo parece incompleto: % parcelas contra % existentes', v_stage_count, v_previous_count;
  END IF;

  UPDATE public.cobmais_importacoes_diarias SET status = 'publicando' WHERE id = p_run_id;

  INSERT INTO public.importacoes (nome_arquivo, credor, total_registros, importado_por)
  VALUES (v_run.nome_arquivo, 'UME | NOVO MUNDO — Cobmais diário', v_stage_count, auth.uid())
  RETURNING id INTO v_importacao_id;

  UPDATE public.devedores d
  SET nome = s.nome,
      valor_original = s.valor,
      valor_atualizado = s.valor,
      data_vencimento = s.vencimento,
      ativo = upper(coalesce(s.status, '')) NOT LIKE 'PAGA%',
      cobmais_chave = s.source_key,
      cobmais_status = nullif(s.status, ''),
      cobmais_atualizado_em = now(),
      cobmais_acordo_detectado = d.cobmais_acordo_detectado OR (
        s.vencimento >= current_date AND d.data_vencimento IS DISTINCT FROM s.vencimento
      ),
      arquivo_importacao = v_run.nome_arquivo,
      importacao_id = v_importacao_id,
      atualizado_em = now()
  FROM public.cobmais_importacao_stage s
  WHERE s.run_id = p_run_id
    AND d.credor IN ('ume_novo_mundo', 'ume_novo_mundo_aporte')
    AND (
      d.cobmais_chave = s.source_key OR
      (d.cobmais_chave IS NULL
       AND public.cpf_normalize(d.cpf) = s.cpf
       AND coalesce(d.contrato, '') = s.contrato
       AND regexp_replace(coalesce(d.descricao, ''), '\\D', '', 'g') = regexp_replace(s.numero_parcela, '\\D', '', 'g')
       AND d.credor = CASE WHEN upper(s.credor) LIKE '%APORTE%' THEN 'ume_novo_mundo_aporte' ELSE 'ume_novo_mundo' END)
    );
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  INSERT INTO public.devedores (
    nome, cpf, valor_original, valor_atualizado, descricao, contrato, data_vencimento,
    importado_por, arquivo_importacao, ativo, credor, importacao_id,
    cobmais_chave, cobmais_status, cobmais_atualizado_em, cobmais_acordo_detectado
  )
  SELECT s.nome, s.cpf, s.valor, s.valor, 'Parcela ' || s.numero_parcela, s.contrato, s.vencimento,
         auth.uid(), v_run.nome_arquivo, upper(coalesce(s.status, '')) NOT LIKE 'PAGA%',
         CASE WHEN upper(s.credor) LIKE '%APORTE%' THEN 'ume_novo_mundo_aporte' ELSE 'ume_novo_mundo' END,
         v_importacao_id, s.source_key, nullif(s.status, ''), now(), s.vencimento >= current_date
  FROM public.cobmais_importacao_stage s
  WHERE s.run_id = p_run_id
    AND NOT EXISTS (
      SELECT 1 FROM public.devedores d
      WHERE d.credor IN ('ume_novo_mundo', 'ume_novo_mundo_aporte')
        AND (d.cobmais_chave = s.source_key OR
          (d.cobmais_chave IS NULL
           AND public.cpf_normalize(d.cpf) = s.cpf
           AND coalesce(d.contrato, '') = s.contrato
           AND regexp_replace(coalesce(d.descricao, ''), '\\D', '', 'g') = regexp_replace(s.numero_parcela, '\\D', '', 'g')
           AND d.credor = CASE WHEN upper(s.credor) LIKE '%APORTE%' THEN 'ume_novo_mundo_aporte' ELSE 'ume_novo_mundo' END))
    );
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  SELECT count(*) INTO v_paid
  FROM public.cobmais_importacao_stage
  WHERE run_id = p_run_id AND upper(coalesce(status, '')) LIKE 'PAGA%';

  UPDATE public.devedores d
  SET ativo = false,
      cobmais_status = 'PAGA — ausente na exportação mais recente',
      cobmais_atualizado_em = now(),
      atualizado_em = now()
  WHERE d.credor IN ('ume_novo_mundo', 'ume_novo_mundo_aporte')
    AND d.ativo = true
    AND NOT EXISTS (
      SELECT 1 FROM public.cobmais_importacao_stage s
      WHERE s.run_id = p_run_id
        AND (s.source_key = d.cobmais_chave OR
          (d.cobmais_chave IS NULL
           AND public.cpf_normalize(d.cpf) = s.cpf
           AND coalesce(d.contrato, '') = s.contrato
           AND regexp_replace(coalesce(d.descricao, ''), '\\D', '', 'g') = regexp_replace(s.numero_parcela, '\\D', '', 'g')
           AND d.credor = CASE WHEN upper(s.credor) LIKE '%APORTE%' THEN 'ume_novo_mundo_aporte' ELSE 'ume_novo_mundo' END))
    );
  GET DIAGNOSTICS v_absent = ROW_COUNT;

  UPDATE public.cobmais_importacoes_diarias
  SET status = 'concluido', registros_processados = v_stage_count, inseridos = v_inserted,
      atualizados = v_updated, pagos = v_paid, ausentes_baixados = v_absent, concluido_em = now()
  WHERE id = p_run_id;

  DELETE FROM public.cobmais_importacao_stage WHERE run_id = p_run_id;

  RETURN jsonb_build_object('inseridos', v_inserted, 'atualizados', v_updated, 'pagos', v_paid, 'ausentes_baixados', v_absent);
EXCEPTION WHEN OTHERS THEN
  UPDATE public.cobmais_importacoes_diarias
  SET status = 'erro', erro_mensagem = SQLERRM, concluido_em = now()
  WHERE id = p_run_id;
  RAISE;
END;
$$;
REVOKE ALL ON FUNCTION public.publicar_importacao_cobmais_diaria(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publicar_importacao_cobmais_diaria(uuid) TO authenticated, service_role;