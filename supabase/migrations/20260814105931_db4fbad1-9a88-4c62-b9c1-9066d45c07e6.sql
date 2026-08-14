CREATE TABLE public.meta_inbox_folder_credores (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  folder_id uuid NOT NULL,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_inbox_folder_credores TO authenticated;
GRANT ALL ON public.meta_inbox_folder_credores TO service_role;

ALTER TABLE public.meta_inbox_folder_credores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "folder credores select" ON public.meta_inbox_folder_credores
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR folder_id = '00000000-0000-0000-0000-000000000000'::uuid
  OR public.meta_inbox_folder_can_view(auth.uid(), folder_id)
);

CREATE POLICY "folder credores admin write" ON public.meta_inbox_folder_credores
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE UNIQUE INDEX meta_inbox_folder_credores_nome_uk
  ON public.meta_inbox_folder_credores (folder_id, lower(nome));

CREATE UNIQUE INDEX meta_inbox_folder_credores_um_ativo_uk
  ON public.meta_inbox_folder_credores (folder_id)
  WHERE ativo;

CREATE TRIGGER update_meta_inbox_folder_credores_updated_at
BEFORE UPDATE ON public.meta_inbox_folder_credores
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();