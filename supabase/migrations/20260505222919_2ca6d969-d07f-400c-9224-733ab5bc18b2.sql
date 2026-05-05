
CREATE TABLE IF NOT EXISTS public.whatsapp_aquecimento_status_imagens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  caption TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.whatsapp_aquecimento_status_imagens ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Admins manage status images"
  ON public.whatsapp_aquecimento_status_imagens FOR ALL TO authenticated
  USING (is_admin_user(auth.uid())) WITH CHECK (is_admin_user(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "All authenticated read status images"
  ON public.whatsapp_aquecimento_status_imagens FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
