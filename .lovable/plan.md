## Objetivo
Preparar o Modo Rajada para amanhã enviar **1000 mensagens no menor tempo possível** usando 2 números de qualidade alta (GREEN), respeitando o teto real da Meta (80 msg/s por número no tier padrão, sem ser bloqueado).

## Diagnóstico do que trava hoje

Investiguei `envio-meta-massa-iniciar` e `pick-meta-instance`:

1. **Trava artificial de velocidade**: `msgs_por_segundo` está clampado em `Math.max(1, Math.min(5, ...))` — no máximo **5 msg/s por instância**, mesmo em rajada. A Meta permite 80. Estamos usando <7% da capacidade.
2. **Round-robin serial via `pick-meta-instance`**: cada envio chama uma função que consulta cota/qualidade/horário no banco. Isso adiciona ~200-500ms de latência por mensagem — mata paralelismo.
3. **Guardrails desnecessários no rajada**: `bloquear_domingo`, `horario_inicio/fim`, `guardrail_ratio_inbound`, `guardrail_block_rate` — todos rodam mesmo em burst e podem pausar as instâncias no meio do teste.
4. **Sem token-bucket real**: hoje o burst worker roda um loop sequencial `await send → await sleep(1000/msgs_por_segundo)`. Não faz `Promise.all` de verdade.

Com o setup atual, 1000 msgs em 2 números = ~1000/(2×1) = **~500 segundos (~8min)** no melhor caso, e frequentemente estoura para 15-20min quando um guardrail dispara.

## O que vamos mudar (só o necessário para o teste de amanhã)

### 1. Novo parâmetro `msgs_por_segundo_por_instancia` no burst
- Remover o clamp `Math.min(5, ...)` no modo rajada em `envio-meta-massa-iniciar`.
- Novo teto: **60 msg/s por instância** (margem de segurança abaixo dos 80 mps documentados pela Meta — evita erro `130429`).
- UI (`EnvioMeta.tsx`): quando "Modo Rajada" estiver ligado, mostrar slider **"Velocidade por número"** (10-60 msg/s, default 30) em vez do delay 30-90s.

### 2. Worker `envio-meta-massa-burst` com token-bucket + Promise.all
- Reescrever o loop principal: em vez de `for item of items { await send }`, usar **janela paralela de N requests simultâneos** (N = `msgs_por_segundo`) com `Promise.allSettled` a cada 1s.
- Ao receber erro `130429` (rate limit), reduzir janela pela metade e esperar 2s. Ao receber 3 sucessos seguidos, subir janela em +5.
- Manter o check de "parar imediato" que já existe (checagem de `status` a cada iteração).

### 3. Bypass de guardrails no rajada
No `envio-meta-massa-burst`, quando `job.modo_rajada = true`:
- Pular checagem de horário/domingo (`bloquear_domingo`, `horario_inicio/fim`).
- Pular `guardrail_ratio_inbound` e `guardrail_block_rate_max_pct`.
- Manter só: instância `ativo=true`, `estado_pool != 'restrita'`, e ausência de template pausado (#132015) / conta bloqueada (#131031).
- **Não** chamar `pick-meta-instance` a cada envio — os itens já vêm pré-atribuídos via round-robin na criação do job (linha 164-166 do `iniciar`). O worker por instância só processa os itens da sua fila.

### 4. UI: card "Velocidade estimada" no `EnvioMeta.tsx`
Antes de disparar, mostrar:
```text
2 números × 30 msg/s = 60 msg/s
1000 mensagens → ETA ~17 segundos
```
Assim você vê o impacto do slider em tempo real.

### 5. Botão "Teste rápido" no `CampanhaDetalheDialog.tsx`
Durante a campanha, mostrar métrica ao vivo:
- **Throughput real (últimos 10s)**: X msg/s
- **Rate limits recebidos**: contador de `130429`
- **Instâncias ativas**: 2/2

## O que NÃO vamos mexer
- Não removeremos a detecção de `#132015` (template pausado) nem `#131031` (BA locked) — elas param a instância corretamente.
- Não mexeremos no modo serial (delay 30-90s) que é o anti-ban padrão.
- Não pediremos upgrade para 1000 mps agora — isso é automático da Meta e depende de histórico. Ficamos no tier padrão de 80 mps.

## ETA esperado com essas mudanças
```text
Config sugerida amanhã: 30 msg/s × 2 números = 60 msg/s
1000 msgs → ~17 segundos de envio real
```
Se os dois números aguentarem sem `130429`, na próxima campanha subimos para 45 msg/s (90/s total) → **~11 segundos**.

## Detalhes técnicos
- Arquivos alterados:
  - `supabase/functions/envio-meta-massa-iniciar/index.ts` — remover clamp `min(5, ...)`, aceitar até 60.
  - `supabase/functions/envio-meta-massa-burst/index.ts` — token-bucket com Promise.allSettled + backoff em `130429` + bypass de guardrails no rajada.
  - `src/pages/EnvioMeta.tsx` — slider "Velocidade por número" (10-60) + card de ETA.
  - `src/components/meta/CampanhaDetalheDialog.tsx` — métricas ao vivo (throughput/10s, rate limits).
- Nada de migration de banco — usa colunas existentes (`msgs_por_segundo`, `modo_rajada`).
- Nada de novo cron/schedule — sem impacto de custo Lovable Cloud recorrente.

Confirma para eu implementar antes do seu teste de amanhã?
