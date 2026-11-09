ALTER TABLE public.ume_proposta_modelos ADD COLUMN IF NOT EXISTS credor text NOT NULL DEFAULT 'ume';
ALTER TABLE public.ume_proposta_modelos DROP CONSTRAINT ume_proposta_modelos_pkey;
ALTER TABLE public.ume_proposta_modelos ADD CONSTRAINT ume_proposta_modelos_pkey PRIMARY KEY (user_id, credor);
ALTER TABLE public.ume_proposta_modelos ADD CONSTRAINT ume_proposta_modelos_credor_chk CHECK (credor IN ('ume','odres_cred','novo_mundo'));