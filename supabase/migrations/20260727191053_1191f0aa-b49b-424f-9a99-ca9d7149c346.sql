
-- 1) Tabela de caixas
CREATE TABLE public.meta_inbox_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cor text NOT NULL DEFAULT '#25D366',
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_inbox_folders TO authenticated;
GRANT ALL ON public.meta_inbox_folders TO service_role;
ALTER TABLE public.meta_inbox_folders ENABLE ROW LEVEL SECURITY;

-- 2) Tabela de membros
CREATE TABLE public.meta_inbox_folder_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id uuid NOT NULL REFERENCES public.meta_inbox_folders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(folder_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_inbox_folder_members TO authenticated;
GRANT ALL ON public.meta_inbox_folder_members TO service_role;
ALTER TABLE public.meta_inbox_folder_members ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_meta_inbox_folder_members_user ON public.meta_inbox_folder_members(user_id);
CREATE INDEX idx_meta_inbox_folder_members_folder ON public.meta_inbox_folder_members(folder_id);

-- 3) Função de acesso (security definer para evitar recursão)
CREATE OR REPLACE FUNCTION public.can_access_meta_folder(_uid uuid, _folder uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _folder IS NULL
    OR public.has_role(_uid, 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.meta_inbox_folders f
      WHERE f.id = _folder AND f.owner_id = _uid
    )
    OR EXISTS (
      SELECT 1 FROM public.meta_inbox_folder_members m
      WHERE m.folder_id = _folder AND m.user_id = _uid
    )
$$;

-- 4) Policies das novas tabelas
CREATE POLICY "folders admin all" ON public.meta_inbox_folders
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "folders owner select" ON public.meta_inbox_folders
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());
CREATE POLICY "folders member select" ON public.meta_inbox_folders
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.meta_inbox_folder_members m
    WHERE m.folder_id = meta_inbox_folders.id AND m.user_id = auth.uid()
  ));

CREATE POLICY "folder members admin all" ON public.meta_inbox_folder_members
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "folder members owner manage" ON public.meta_inbox_folder_members
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.meta_inbox_folders f
    WHERE f.id = meta_inbox_folder_members.folder_id AND f.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.meta_inbox_folders f
    WHERE f.id = meta_inbox_folder_members.folder_id AND f.owner_id = auth.uid()
  ));
CREATE POLICY "folder members self select" ON public.meta_inbox_folder_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 5) Colunas folder_id
ALTER TABLE public.meta_whatsapp_contatos
  ADD COLUMN folder_id uuid NULL REFERENCES public.meta_inbox_folders(id) ON DELETE SET NULL;
CREATE INDEX idx_meta_wa_contatos_folder ON public.meta_whatsapp_contatos(folder_id);

ALTER TABLE public.envio_meta_job
  ADD COLUMN folder_id uuid NULL REFERENCES public.meta_inbox_folders(id) ON DELETE SET NULL;

-- 6) Policy restritiva: esconder contatos/mensagens de caixas customizadas
--    para usuários que não têm acesso.
CREATE POLICY "meta_contatos_folder_restrict" ON public.meta_whatsapp_contatos
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (folder_id IS NULL OR public.can_access_meta_folder(auth.uid(), folder_id))
  WITH CHECK (folder_id IS NULL OR public.can_access_meta_folder(auth.uid(), folder_id));

CREATE POLICY "meta_msgs_folder_restrict" ON public.meta_whatsapp_mensagens
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(),'admin'::app_role)
    OR NOT EXISTS (
      SELECT 1 FROM public.meta_whatsapp_contatos c
      WHERE c.instancia_id = meta_whatsapp_mensagens.instancia_id
        AND c.telefone IS NOT DISTINCT FROM meta_whatsapp_mensagens.telefone
        AND c.folder_id IS NOT NULL
        AND NOT public.can_access_meta_folder(auth.uid(), c.folder_id)
    )
  );

-- 7) Trigger de updated_at para folders
CREATE TRIGGER update_meta_inbox_folders_updated_at
  BEFORE UPDATE ON public.meta_inbox_folders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
