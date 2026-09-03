-- ============ TRILHA ============
CREATE TABLE IF NOT EXISTS public.meta_aquecimento_trilha (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instancia_id uuid NOT NULL REFERENCES public.meta_whatsapp_instances(id) ON DELETE CASCADE,
  dia date NOT NULL,
  tier_atual integer,
  tier_alvo integer,
  alvo_unicos_dia integer NOT NULL DEFAULT 20,
  unicos_7d integer NOT NULL DEFAULT 0,
  mix_uazapi_pct integer NOT NULL DEFAULT 60,
  mix_leads_pct integer NOT NULL DEFAULT 40,
  decisao_ia jsonb,
  status text NOT NULL DEFAULT 'ativa',
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instancia_id, dia)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_aquecimento_trilha TO authenticated;
GRANT ALL ON public.meta_aquecimento_trilha TO service_role;
ALTER TABLE public.meta_aquecimento_trilha ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aq_trilha_admin_all" ON public.meta_aquecimento_trilha FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ LOG DE DESTINOS ============
CREATE TABLE IF NOT EXISTS public.meta_aquecimento_destino_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dia date NOT NULL,
  instancia_id uuid REFERENCES public.meta_whatsapp_instances(id) ON DELETE SET NULL,
  fonte text NOT NULL,
  destino_telefone text NOT NULL,
  destino_instancia_id uuid,
  lead_id uuid,
  nicho text,
  cidade text,
  template text,
  custo_estimado numeric NOT NULL DEFAULT 0,
  wamid text,
  status text NOT NULL DEFAULT 'enviado',
  erro text,
  enviado_em timestamptz NOT NULL DEFAULT now(),
  entregue_em timestamptz,
  lido_em timestamptz,
  respondeu_em timestamptz,
  segundos_para_resposta integer
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_aquecimento_destino_log TO authenticated;
GRANT ALL ON public.meta_aquecimento_destino_log TO service_role;
ALTER TABLE public.meta_aquecimento_destino_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aq_destino_log_admin_all" ON public.meta_aquecimento_destino_log FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS idx_aq_log_dia_inst ON public.meta_aquecimento_destino_log (dia, instancia_id);
CREATE INDEX IF NOT EXISTS idx_aq_log_wamid ON public.meta_aquecimento_destino_log (wamid);
CREATE INDEX IF NOT EXISTS idx_aq_log_tel ON public.meta_aquecimento_destino_log (destino_telefone, enviado_em DESC);
CREATE INDEX IF NOT EXISTS idx_aq_log_nicho ON public.meta_aquecimento_destino_log (nicho, enviado_em DESC);

-- ============ SCORE DE NICHOS ============
CREATE TABLE IF NOT EXISTS public.aquecimento_nicho_score (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nicho text NOT NULL,
  cidade text NOT NULL DEFAULT '',
  envios integer NOT NULL DEFAULT 0,
  respostas integer NOT NULL DEFAULT 0,
  respostas_rapidas integer NOT NULL DEFAULT 0,
  reclamacoes integer NOT NULL DEFAULT 0,
  score numeric NOT NULL DEFAULT 0,
  bloqueado boolean NOT NULL DEFAULT false,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (nicho, cidade)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aquecimento_nicho_score TO authenticated;
GRANT ALL ON public.aquecimento_nicho_score TO service_role;
ALTER TABLE public.aquecimento_nicho_score ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aq_nicho_score_admin_all" ON public.aquecimento_nicho_score FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ IDEIAS DE TEMPLATES ============
CREATE TABLE IF NOT EXISTS public.meta_template_ideias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_sugerido text NOT NULL,
  categoria text NOT NULL DEFAULT 'UTILITY',
  idioma text NOT NULL DEFAULT 'pt_BR',
  corpo text NOT NULL,
  botoes jsonb NOT NULL DEFAULT '[]'::jsonb,
  justificativa text,
  status text NOT NULL DEFAULT 'rascunho',
  bm_id uuid,
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_template_ideias TO authenticated;
GRANT ALL ON public.meta_template_ideias TO service_role;
ALTER TABLE public.meta_template_ideias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meta_template_ideias_admin_all" ON public.meta_template_ideias FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ ORÇAMENTO ============
CREATE TABLE IF NOT EXISTS public.meta_aquecimento_orcamento (
  dia date PRIMARY KEY,
  teto_reais numeric NOT NULL DEFAULT 50,
  gasto_reais numeric NOT NULL DEFAULT 0,
  custo_utility numeric NOT NULL DEFAULT 0.04,
  custo_marketing numeric NOT NULL DEFAULT 0.20,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_aquecimento_orcamento TO authenticated;
GRANT ALL ON public.meta_aquecimento_orcamento TO service_role;
ALTER TABLE public.meta_aquecimento_orcamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aq_orcamento_admin_all" ON public.meta_aquecimento_orcamento FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ LEADS ============
ALTER TABLE public.google_maps_leads
  ADD COLUMN IF NOT EXISTS usado_aquecimento_em timestamptz,
  ADD COLUMN IF NOT EXISTS resultado_aquecimento text;
CREATE INDEX IF NOT EXISTS idx_gm_leads_aquec ON public.google_maps_leads (tem_whatsapp, usado_aquecimento_em);

-- ============ CRONS ============
DO $do$
DECLARE k text;
BEGIN
  SELECT substring(command from '"apikey":"([^"]+)"') INTO k FROM cron.job WHERE jobname = 'meta-rampup-diario' LIMIT 1;
  IF k IS NULL THEN RETURN; END IF;

  PERFORM cron.unschedule('meta-aquecimento-planejar-diario') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='meta-aquecimento-planejar-diario');
  PERFORM cron.schedule('meta-aquecimento-planejar-diario', '0 10 * * *', format(
    $f$select net.http_post(url:='https://cymdrkeukockakfzjeen.supabase.co/functions/v1/meta-aquecimento-planejar', headers:='{"Content-Type":"application/json","apikey":"%s"}'::jsonb, body:='{}'::jsonb);$f$, k));

  PERFORM cron.unschedule('meta-aquecimento-aprender-diario') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='meta-aquecimento-aprender-diario');
  PERFORM cron.schedule('meta-aquecimento-aprender-diario', '0 0 * * *', format(
    $f$select net.http_post(url:='https://cymdrkeukockakfzjeen.supabase.co/functions/v1/meta-aquecimento-aprender', headers:='{"Content-Type":"application/json","apikey":"%s"}'::jsonb, body:='{}'::jsonb);$f$, k));
END
$do$;