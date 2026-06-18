CREATE TABLE IF NOT EXISTS public.modelo_mensagem_estado (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  clientes jsonb NOT NULL DEFAULT '[]'::jsonb,
  contatados jsonb NOT NULL DEFAULT '[]'::jsonb,
  desc_vista_global numeric NOT NULL DEFAULT 50,
  desc_parcelado_global numeric NOT NULL DEFAULT 30,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.modelo_mensagem_estado TO authenticated;
GRANT ALL ON public.modelo_mensagem_estado TO service_role;

ALTER TABLE public.modelo_mensagem_estado ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own row select" ON public.modelo_mensagem_estado
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own row insert" ON public.modelo_mensagem_estado
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own row update" ON public.modelo_mensagem_estado
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own row delete" ON public.modelo_mensagem_estado
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_modelo_mensagem_estado_updated
  BEFORE UPDATE ON public.modelo_mensagem_estado
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();