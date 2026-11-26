CREATE TABLE public.ume_teto_parcelas_caixa (
  caixa text PRIMARY KEY,
  max_parcelas integer NOT NULL DEFAULT 18 CHECK (max_parcelas BETWEEN 1 AND 18),
  atualizado_por uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.ume_teto_parcelas_caixa TO authenticated;
GRANT ALL ON public.ume_teto_parcelas_caixa TO service_role;
ALTER TABLE public.ume_teto_parcelas_caixa ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.pode_gerir_teto_caixa(_uid uuid, _caixa text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_uid, 'admin')
    OR (_caixa <> 'padrao' AND EXISTS (
      SELECT 1 FROM public.meta_inbox_folders f WHERE f.id::text = _caixa AND f.owner_id = _uid));
$$;

CREATE POLICY "staff le teto" ON public.ume_teto_parcelas_caixa FOR SELECT TO authenticated
  USING (public.is_staff_member(auth.uid()));
CREATE POLICY "gestor insere teto" ON public.ume_teto_parcelas_caixa FOR INSERT TO authenticated
  WITH CHECK (public.pode_gerir_teto_caixa(auth.uid(), caixa));
CREATE POLICY "gestor altera teto" ON public.ume_teto_parcelas_caixa FOR UPDATE TO authenticated
  USING (public.pode_gerir_teto_caixa(auth.uid(), caixa))
  WITH CHECK (public.pode_gerir_teto_caixa(auth.uid(), caixa));

ALTER TABLE public.meta_whatsapp_contatos ADD COLUMN IF NOT EXISTS prioridade_pagamento_em timestamptz;

CREATE OR REPLACE FUNCTION public.meta_prioridade_pagamento_trg()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.direcao = 'entrada'
     AND NEW.conteudo ~* '^\s*(quero\s+o\s+boleto|sim,?\s+enviar\s+pix\s+agora)\s*[!.]?\s*$' THEN
    UPDATE public.meta_whatsapp_contatos SET prioridade_pagamento_em = now()
     WHERE instancia_id = NEW.instancia_id AND telefone = NEW.telefone AND folder_id IS NULL;
  ELSIF NEW.direcao = 'saida' AND NEW.origem_envio = 'humano' THEN
    UPDATE public.meta_whatsapp_contatos SET prioridade_pagamento_em = NULL
     WHERE instancia_id = NEW.instancia_id AND telefone = NEW.telefone AND prioridade_pagamento_em IS NOT NULL;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_meta_prioridade_pagamento AFTER INSERT ON public.meta_whatsapp_mensagens
  FOR EACH ROW EXECUTE FUNCTION public.meta_prioridade_pagamento_trg();