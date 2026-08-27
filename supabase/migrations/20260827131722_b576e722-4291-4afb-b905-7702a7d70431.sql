ALTER TABLE public.meta_destinatario_supressao
  ADD COLUMN IF NOT EXISTS instancia_id uuid REFERENCES public.meta_whatsapp_instances(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS origem_user_id uuid,
  ADD COLUMN IF NOT EXISTS contato_nome text,
  ADD COLUMN IF NOT EXISTS credor text;

CREATE INDEX IF NOT EXISTS idx_supressao_instancia ON public.meta_destinatario_supressao(instancia_id);
CREATE INDEX IF NOT EXISTS idx_supressao_criado_em ON public.meta_destinatario_supressao(criado_em DESC);

GRANT SELECT ON public.meta_destinatario_supressao TO authenticated;
GRANT ALL ON public.meta_destinatario_supressao TO service_role;

DROP POLICY IF EXISTS supressao_select_visivel ON public.meta_destinatario_supressao;
CREATE POLICY supressao_select_visivel
  ON public.meta_destinatario_supressao
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (instancia_id IS NOT NULL AND public.pode_ver_instancia_meta(auth.uid(), instancia_id))
  );