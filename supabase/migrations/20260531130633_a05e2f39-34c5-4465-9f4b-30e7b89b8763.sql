CREATE TABLE public.comite_carteira_nm_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  importado_em timestamptz NOT NULL DEFAULT now(),
  importado_por uuid,
  arquivo_nome text,
  total_linhas integer NOT NULL DEFAULT 0,
  total_cpfs_unicos integer NOT NULL DEFAULT 0,
  total_risco numeric NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true
);

CREATE TABLE public.comite_carteira_nm_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid NOT NULL REFERENCES public.comite_carteira_nm_snapshot(id) ON DELETE CASCADE,
  cpf_cnpj text NOT NULL,
  credor_tipo text NOT NULL,
  atraso_dias integer NOT NULL DEFAULT 0,
  risco numeric NOT NULL DEFAULT 0,
  faixa text NOT NULL
);

CREATE INDEX idx_cnm_item_snapshot ON public.comite_carteira_nm_item(snapshot_id);
CREATE INDEX idx_cnm_item_faixa ON public.comite_carteira_nm_item(snapshot_id, faixa);
CREATE INDEX idx_cnm_item_tipo ON public.comite_carteira_nm_item(snapshot_id, credor_tipo);
CREATE INDEX idx_cnm_snap_ativo ON public.comite_carteira_nm_snapshot(ativo) WHERE ativo = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comite_carteira_nm_snapshot TO authenticated;
GRANT ALL ON public.comite_carteira_nm_snapshot TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comite_carteira_nm_item TO authenticated;
GRANT ALL ON public.comite_carteira_nm_item TO service_role;

ALTER TABLE public.comite_carteira_nm_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comite_carteira_nm_item ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin all snapshot" ON public.comite_carteira_nm_snapshot
  FOR ALL TO authenticated
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

CREATE POLICY "admin all item" ON public.comite_carteira_nm_item
  FOR ALL TO authenticated
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));