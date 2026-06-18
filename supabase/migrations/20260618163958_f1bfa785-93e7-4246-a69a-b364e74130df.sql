CREATE TABLE public.modelo_mensagem_template (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  template TEXT NOT NULL DEFAULT '',
  desconto_padrao NUMERIC NOT NULL DEFAULT 50,
  parcelas_padrao INTEGER NOT NULL DEFAULT 12,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.modelo_mensagem_template TO authenticated;
GRANT ALL ON public.modelo_mensagem_template TO service_role;

ALTER TABLE public.modelo_mensagem_template ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own template"
ON public.modelo_mensagem_template
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER modelo_mensagem_template_updated_at
BEFORE UPDATE ON public.modelo_mensagem_template
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();