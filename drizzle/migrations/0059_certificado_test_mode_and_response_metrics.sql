ALTER TABLE public.meta_envio_pool_config
  ADD COLUMN IF NOT EXISTS google_maps_captacao_ativa boolean NOT NULL DEFAULT true;

ALTER TABLE public.certificado_config
  ADD COLUMN IF NOT EXISTS modo_teste_casa_dados boolean NOT NULL DEFAULT false;

ALTER TABLE public.certificado_prospeccao_envios
  ADD COLUMN IF NOT EXISTS resposta_classificacao text,
  ADD COLUMN IF NOT EXISTS interesse_confirmado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS transferido_humano boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS resposta_texto text;

CREATE INDEX IF NOT EXISTS certificado_envios_metricas_idx
  ON public.certificado_prospeccao_envios (template_nome, status, reservado_em DESC);

COMMENT ON COLUMN public.meta_envio_pool_config.google_maps_captacao_ativa IS 'Controle reversível da captação automática e manual de novos leads do Google Maps.';
COMMENT ON COLUMN public.certificado_config.modo_teste_casa_dados IS 'Ativa o teste controlado de 50 contatos por faixa D+5 a D+30 usando a Casa dos Dados.';
COMMENT ON COLUMN public.certificado_prospeccao_envios.resposta_classificacao IS 'Classificação comercial da resposta feita pela CLARA.';