CREATE TABLE public.certificado_casa_dados_credencial (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  chave_cifrada text NOT NULL,
  iv text NOT NULL,
  sufixo text NOT NULL CHECK (char_length(sufixo) <= 8),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.certificado_casa_dados_credencial TO service_role;
ALTER TABLE public.certificado_casa_dados_credencial ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.certificado_casa_dados_credencial IS 'Credencial cifrada da Casa dos Dados; acesso exclusivo por funções administrativas protegidas.';