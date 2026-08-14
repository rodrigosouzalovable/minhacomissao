CREATE TABLE public.meta_inbox_folder_iago_janela (
  folder_id uuid PRIMARY KEY,
  ativo boolean NOT NULL DEFAULT false,
  hora_inicio time NOT NULL DEFAULT '17:00',
  hora_fim time NOT NULL DEFAULT '08:00',
  fim_semana_24h boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_inbox_folder_iago_janela TO authenticated;
GRANT ALL ON public.meta_inbox_folder_iago_janela TO service_role;

ALTER TABLE public.meta_inbox_folder_iago_janela ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins e gestores gerenciam plantao IAGO"
ON public.meta_inbox_folder_iago_janela
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

CREATE TRIGGER update_meta_inbox_folder_iago_janela_updated_at
BEFORE UPDATE ON public.meta_inbox_folder_iago_janela
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();