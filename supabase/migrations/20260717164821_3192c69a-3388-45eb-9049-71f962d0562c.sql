
ALTER TABLE public.meta_lembrete_log ALTER COLUMN pagamento_id DROP NOT NULL;
ALTER TABLE public.meta_lembrete_log DROP CONSTRAINT IF EXISTS meta_lembrete_log_tipo_check;
ALTER TABLE public.meta_lembrete_log ADD CONSTRAINT meta_lembrete_log_tipo_check CHECK (tipo = ANY (ARRAY['D-3'::text, 'D0'::text, 'teste'::text]));
ALTER TABLE public.meta_lembrete_log DROP CONSTRAINT IF EXISTS meta_lembrete_log_pagamento_id_tipo_data_ref_key;
CREATE UNIQUE INDEX IF NOT EXISTS meta_lembrete_log_pagamento_tipo_dataref_uidx
  ON public.meta_lembrete_log (pagamento_id, tipo, data_ref)
  WHERE pagamento_id IS NOT NULL;
