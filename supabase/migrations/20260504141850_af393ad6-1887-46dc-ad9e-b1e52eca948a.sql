-- 1. Adicionar campos de status/erro/origem na tabela de envios
ALTER TABLE public.aquecimento_envios_autosave
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'enviado',
  ADD COLUMN IF NOT EXISTS erro_detalhe TEXT NULL,
  ADD COLUMN IF NOT EXISTS origem TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_autosave_envios_status ON public.aquecimento_envios_autosave(status);
CREATE INDEX IF NOT EXISTS idx_autosave_envios_enviado_em ON public.aquecimento_envios_autosave(enviado_em DESC);

-- 2. Tabela singleton de configuração
CREATE TABLE IF NOT EXISTS public.aquecimento_autosave_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  ancora_probability NUMERIC NOT NULL DEFAULT 0.7 CHECK (ancora_probability >= 0 AND ancora_probability <= 1),
  ativo BOOLEAN NOT NULL DEFAULT true,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_por UUID NULL,
  CONSTRAINT singleton_check CHECK (id = 1)
);

INSERT INTO public.aquecimento_autosave_config (id, ancora_probability, ativo)
VALUES (1, 0.7, true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.aquecimento_autosave_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam autosave config"
  ON public.aquecimento_autosave_config
  FOR ALL
  TO authenticated
  USING (is_admin_user(auth.uid()))
  WITH CHECK (is_admin_user(auth.uid()));

-- 3. Permitir admins inserirem envios manualmente (para a edge function via service role já funciona, mas isso garante leitura via UI)
-- A policy SELECT existente já cobre admins.
