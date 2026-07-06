## Problema

Delay configurado (5–10s) não é respeitado. Causas:

1. **Cron a cada 20s** — worker só acorda de 20 em 20 segundos, então delays menores viram efetivamente ≥20s.
2. **1 item por invocação** — mesmo com `proximo_em` já vencido, o worker só processa 1 item e devolve, aguardando o próximo cron.
3. **Reagendos "duros" sobrescrevem o delay do usuário** — quando `pick-meta-instance` devolve `sem_disponivel`/erro genérico ou `send-whatsapp-meta` devolve `tier_full`/`pool_blocked`, o job é reagendado para +30s/+1min/+5min independentemente do delay configurado. É o que gera "próximo envio em 288s" no print.

## Correção

### `supabase/functions/envio-meta-massa-tick/index.ts` (refactor)
- **Loop interno** dentro de uma invocação: após processar um item, aguarda o `delay` configurado (`min_seg`–`max_seg`) via `sleep` e processa o próximo, respeitando budget de ~50s por invocação (limite de edge function).
- **Self-invoke** (`fetch` fire-and-forget da própria função) sempre que o budget termina com o job ainda `rodando`, garantindo continuidade sem depender do cron. Também dispara self-invoke após qualquer wait curto (≤30s) para não esperar o próximo cron.
- **Re-fetch do job** a cada iteração para respeitar pausar/cancelar em tempo real.
- **Wait curto** para bloqueios transitórios: se `pick` falha por `sem_disponivel`, aguarda 60s dentro do loop (se couber no budget) em vez de fixar `proximo_em = +5min`. Bloqueios "duros" (`domingo`/`horario`) continuam em 10min (regra de negócio).
- Nenhuma alteração em regras de tier, horário 08–20 BRT, domingo, seleção de instância, template ou envio propriamente dito.

### Cron (via `supabase.insert` no `cron.job`)
- Reduzir intervalo do `envio-meta-massa-tick` de 20s para 10s. Serve apenas de safety-net; o self-invoke é o mecanismo principal.

### Sem alterações em
- Frontend (`EnvioMetaSendingContext.tsx`, `EnvioMeta.tsx`)
- `envio-meta-massa-iniciar` / `envio-meta-massa-control`
- `pick-meta-instance` / `send-whatsapp-meta`

## Resultado esperado
Com 5–10s configurado, cada envio sai em 5–10s reais. O "próximo envio em Xs" só passa disso quando houver bloqueio real (tier cheio, domingo, fora de horário) — e nesses casos o motivo aparece em `status_motivo`.

## Custo Lovable Cloud
Aumento marginal: cron 20s → 10s (~8,6k invocações/dia extras quando não há job). Self-invoke só dispara com job ativo. Custo desprezível frente ao custo Meta por mensagem.