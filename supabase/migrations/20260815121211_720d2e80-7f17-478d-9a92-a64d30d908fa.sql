CREATE TABLE public.meta_webhook_tokens (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX meta_webhook_tokens_token_key ON public.meta_webhook_tokens (token);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_webhook_tokens TO authenticated;
GRANT ALL ON public.meta_webhook_tokens TO service_role;

ALTER TABLE public.meta_webhook_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meta_webhook_tokens_own" ON public.meta_webhook_tokens
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "meta_webhook_tokens_admin" ON public.meta_webhook_tokens
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));