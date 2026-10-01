ALTER TABLE public.acordos
  ADD COLUMN IF NOT EXISTS telefone_confirmado_em timestamptz,
  ADD COLUMN IF NOT EXISTS telefone_confirmado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS termo_formalizacao_status text NOT NULL DEFAULT 'legado',
  ADD COLUMN IF NOT EXISTS termo_formalizado_em timestamptz,
  ADD COLUMN IF NOT EXISTS termo_formalizado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS termo_formalizacao_metodo text,
  ADD COLUMN IF NOT EXISTS termo_meta_instancia_id uuid REFERENCES public.meta_whatsapp_instances(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS termo_meta_contato_id uuid REFERENCES public.meta_whatsapp_contatos(id) ON DELETE SET NULL;

ALTER TABLE public.acordos_devedor
  ADD COLUMN IF NOT EXISTS cliente_nome text,
  ADD COLUMN IF NOT EXISTS cliente_telefone text,
  ADD COLUMN IF NOT EXISTS credor text,
  ADD COLUMN IF NOT EXISTS telefone_confirmado_em timestamptz,
  ADD COLUMN IF NOT EXISTS telefone_confirmado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS termo_formalizacao_status text NOT NULL DEFAULT 'legado',
  ADD COLUMN IF NOT EXISTS termo_formalizado_em timestamptz,
  ADD COLUMN IF NOT EXISTS termo_formalizado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS termo_formalizacao_metodo text,
  ADD COLUMN IF NOT EXISTS termo_meta_instancia_id uuid REFERENCES public.meta_whatsapp_instances(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS termo_meta_contato_id uuid REFERENCES public.meta_whatsapp_contatos(id) ON DELETE SET NULL;

ALTER TABLE public.acordos
  ADD CONSTRAINT acordos_termo_formalizacao_status_check CHECK (termo_formalizacao_status IN ('legado', 'pendente', 'concluido')),
  ADD CONSTRAINT acordos_termo_formalizacao_metodo_check CHECK (termo_formalizacao_metodo IS NULL OR termo_formalizacao_metodo IN ('download', 'whatsapp'));

ALTER TABLE public.acordos_devedor
  ADD CONSTRAINT acordos_devedor_termo_formalizacao_status_check CHECK (termo_formalizacao_status IN ('legado', 'pendente', 'concluido')),
  ADD CONSTRAINT acordos_devedor_termo_formalizacao_metodo_check CHECK (termo_formalizacao_metodo IS NULL OR termo_formalizacao_metodo IN ('download', 'whatsapp'));

CREATE INDEX IF NOT EXISTS idx_acordos_formalizacao_pendente
  ON public.acordos (user_id, criado_em DESC)
  WHERE termo_formalizacao_status = 'pendente';

CREATE INDEX IF NOT EXISTS idx_acordos_devedor_formalizacao_pendente
  ON public.acordos_devedor (criado_por, criado_em DESC)
  WHERE termo_formalizacao_status = 'pendente';