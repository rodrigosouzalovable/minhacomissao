CREATE INDEX IF NOT EXISTS idx_devedores_dedupe_ativo
  ON public.devedores (cpf, contrato, descricao, data_vencimento)
  WHERE ativo = true;