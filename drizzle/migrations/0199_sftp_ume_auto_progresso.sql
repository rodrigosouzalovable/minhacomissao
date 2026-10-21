CREATE TABLE public.sftp_ume_auto_progresso (
  pasta text PRIMARY KEY,
  arquivo text NOT NULL,
  tamanho bigint NOT NULL,
  modificado bigint NOT NULL,
  posicao bigint NOT NULL DEFAULT 0,
  data_lote date,
  carteira text,
  total_linhas integer NOT NULL DEFAULT 0,
  clientes integer NOT NULL DEFAULT 0,
  parcelas integer NOT NULL DEFAULT 0,
  baixas jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'processando',
  erro text,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sftp_ume_auto_progresso TO authenticated;
GRANT ALL ON public.sftp_ume_auto_progresso TO service_role;
ALTER TABLE public.sftp_ume_auto_progresso ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins veem progresso SFTP" ON public.sftp_ume_auto_progresso FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));