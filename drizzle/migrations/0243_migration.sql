CREATE TABLE public.ume_sessoes_usuario (
  user_id uuid NOT NULL,
  ambiente text NOT NULL,
  ume_username text NOT NULL,
  access_token text NOT NULL,
  access_expira_em timestamptz NOT NULL,
  refresh_token text,
  refresh_expira_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, ambiente)
);
GRANT ALL ON public.ume_sessoes_usuario TO service_role;
ALTER TABLE public.ume_sessoes_usuario ENABLE ROW LEVEL SECURITY;
-- Sem políticas: somente o servidor (service role) lê os tokens.
ALTER TABLE public.ume_boleto_log ADD COLUMN IF NOT EXISTS ume_username text;