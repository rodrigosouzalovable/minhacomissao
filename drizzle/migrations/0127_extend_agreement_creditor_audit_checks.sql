ALTER TABLE public.acordo_credor_auditoria
  DROP CONSTRAINT acordo_credor_auditoria_credor_anterior_check;
ALTER TABLE public.acordo_credor_auditoria
  ADD CONSTRAINT acordo_credor_auditoria_credor_anterior_check
  CHECK (credor_anterior = ANY (ARRAY['ume_novo_mundo'::text, 'mundo_da_moda'::text, 'odres_cred'::text]));

ALTER TABLE public.acordo_credor_auditoria
  DROP CONSTRAINT acordo_credor_auditoria_credor_novo_check;
ALTER TABLE public.acordo_credor_auditoria
  ADD CONSTRAINT acordo_credor_auditoria_credor_novo_check
  CHECK (credor_novo = ANY (ARRAY['ume_novo_mundo'::text, 'mundo_da_moda'::text, 'odres_cred'::text]));