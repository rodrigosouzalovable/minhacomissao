ALTER TABLE public.modelo_mensagem_template
  ADD COLUMN IF NOT EXISTS template_2 text,
  ADD COLUMN IF NOT EXISTS desconto_padrao_2 numeric,
  ADD COLUMN IF NOT EXISTS desconto_parcelado_padrao_2 numeric,
  ADD COLUMN IF NOT EXISTS parcelas_padrao_2 integer;