---
name: Campanha Meta aguardando cota
description: Campanha de envio massa Meta sem cota diária fica em espera visível e retoma sozinha, sem loop de erro/reativação
type: feature
---

Quando todas as instâncias de uma campanha (`envio_meta_job`) batem o teto diário / freio de qualidade / quarentena:

- O worker `envio-meta-massa-tick` NÃO encerra o job como `erro`. Mantém `status='rodando'` e grava
  `status_motivo = 'AGUARDANDO_COTA:<retomaISO>:<detalhe>'` com `proximo_em` = 30 min à frente dentro da
  janela 08–19h BRT, ou 08:00 BRT do próximo dia útil (pula domingo).
- Bloqueio definitivo (todas ignoradas por falhas consecutivas) continua virando `status='erro'`.
- Aviso único por campanha/dia no WhatsApp admin (`tipo: envio_meta_aguardando_cota`).
- Front (`EnvioMetaSendingContext`): `refreshCountersJob` lê `status` e `status_motivo` reais;
  `parseAguardandoCota` alimenta `progresso.aguardandoCota/cotaMotivo/cotaRetomaEm`.
- Auto-retomada do front nunca dispara em motivos de cota/qualidade e tem limite de 3 tentativas por job.
- `CampanhaDetalheDialog`: selo âmbar "Aguardando cota", banner com o motivo por instância, horário da
  retomada e ação "Instâncias com cota livre" → `envio-meta-massa-control` (`instancias_livres` /
  `adicionar_instancias_livres`), que só oferece instâncias Meta ativas, não RED, fora de recuperação/restrição e com folga.
