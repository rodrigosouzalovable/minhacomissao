CREATE TABLE public.meta_bm_escalada_piloto (
  bm_id uuid PRIMARY KEY REFERENCES public.meta_business_managers(id) ON DELETE CASCADE,
  ativo boolean NOT NULL DEFAULT false,
  etapa integer NOT NULL DEFAULT 1 CHECK (etapa BETWEEN 1 AND 3),
  metas_diarias integer[] NOT NULL DEFAULT ARRAY[450, 550, 650],
  mix_leads_pct integer NOT NULL DEFAULT 90 CHECK (mix_leads_pct BETWEEN 0 AND 100),
  entrega_min_pct numeric NOT NULL DEFAULT 95 CHECK (entrega_min_pct BETWEEN 0 AND 100),
  falha_reduzir_pct numeric NOT NULL DEFAULT 3 CHECK (falha_reduzir_pct BETWEEN 0 AND 100),
  falha_pausar_pct numeric NOT NULL DEFAULT 5 CHECK (falha_pausar_pct BETWEEN 0 AND 100),
  status text NOT NULL DEFAULT 'escalando',
  motivo text,
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  encerrado_em timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_bm_escalada_piloto TO authenticated;
GRANT ALL ON public.meta_bm_escalada_piloto TO service_role;
ALTER TABLE public.meta_bm_escalada_piloto ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage Meta BM scaling pilots"
ON public.meta_bm_escalada_piloto
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE public.meta_bm_escalada_diaria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bm_id uuid NOT NULL REFERENCES public.meta_business_managers(id) ON DELETE CASCADE,
  dia date NOT NULL,
  etapa integer NOT NULL,
  meta_unicos integer NOT NULL DEFAULT 0,
  enviados_unicos integer NOT NULL DEFAULT 0,
  entregues_unicos integer NOT NULL DEFAULT 0,
  respostas integer NOT NULL DEFAULT 0,
  falhas integer NOT NULL DEFAULT 0,
  qualidade text,
  tier_oficial integer,
  status text NOT NULL DEFAULT 'planejado',
  motivo text,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bm_id, dia)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_bm_escalada_diaria TO authenticated;
GRANT ALL ON public.meta_bm_escalada_diaria TO service_role;
ALTER TABLE public.meta_bm_escalada_diaria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view Meta BM scaling history"
ON public.meta_bm_escalada_diaria
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE INDEX meta_bm_escalada_diaria_bm_dia_idx
ON public.meta_bm_escalada_diaria (bm_id, dia DESC);