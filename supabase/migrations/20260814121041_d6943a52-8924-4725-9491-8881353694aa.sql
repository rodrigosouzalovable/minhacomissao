ALTER TABLE public.meta_contato_qualificacao DROP CONSTRAINT meta_contato_qualificacao_pkey;
ALTER TABLE public.meta_contato_qualificacao ADD CONSTRAINT meta_contato_qualificacao_pkey PRIMARY KEY (contato_id, qualificacao_id);
CREATE INDEX IF NOT EXISTS idx_meta_contato_qualif_contato ON public.meta_contato_qualificacao (contato_id);