CREATE TABLE IF NOT EXISTS public.ume_consultas_cache (
  cpf text PRIMARY KEY,
  payload jsonb NOT NULL,
  encontrado boolean NOT NULL DEFAULT false,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ume_consultas_cache TO authenticated;
GRANT ALL ON public.ume_consultas_cache TO service_role;

ALTER TABLE public.ume_consultas_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ver o cache UME"
ON public.ume_consultas_cache FOR SELECT TO authenticated USING (true);

ALTER TABLE public.iago_config
  ADD COLUMN IF NOT EXISTS ume_tabela text NOT NULL DEFAULT 'padrao',
  ADD COLUMN IF NOT EXISTS ume_consulta_ativa boolean NOT NULL DEFAULT true;