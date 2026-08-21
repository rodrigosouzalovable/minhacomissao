# Janela de disparo: 08h às 19h BRT

Hoje a configuração do pool Meta está com **09:00 às 19:00** (confirmado no banco: `horario_inicio = 09:00:00`, `horario_fim = 19:00:00`). Por isso a campanha "CSIM 48" mostrou "Aguardando abertura da janela de envio (09:00 BRT)".

## O que muda

- Início da janela passa a ser **08:00 BRT**; fim permanece **19:00 BRT**.
- Campanhas iniciadas a partir das 08:00 disparam de imediato, sem espera.
- Continua valendo o bloqueio de domingo (como está hoje) e vale para todos os parceiros Meta, pois o motor de envio lê a mesma configuração.
- O aquecimento entre números oficiais (que hoje só roda das 09h às 19h) passa a acompanhar a mesma janela 08h–19h, para ficar tudo alinhado.

## Detalhes técnicos

1. Atualizar a linha `id = 1` de `meta_envio_pool_config`: `horario_inicio = '08:00:00'` (mantendo `horario_fim = '19:00:00'`). Isso já reflete em `pick-meta-instance`, `_shared/metaJanelaEnvio.ts`, `envio-meta-massa-tick` e `envio-meta-massa-burst`, que leem a config.
2. `supabase/functions/meta-aquecimento-tick/index.ts`: trocar o corte fixo `hora < 9 || hora >= 19` pela leitura de `horario_inicio`/`horario_fim` da mesma config (fallback 8/19).
3. Sem novo cron, sem novo polling, sem mudança de schema — nenhum impacto de custo.
