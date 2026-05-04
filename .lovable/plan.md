## Diagnóstico

O `aquecimento-envio-autosave` **NÃO está rodando automaticamente**. Estado atual:

- Cron jobs ativos do aquecimento: apenas `whatsapp-aquecimento` (IA ping-pong, 1x/hora 08-20h) e `aquecimento-promocao-fase` (1x/dia)
- **`aquecimento-envio-autosave` foi desligado** no corte emergencial e nunca foi reativado
- **43 instâncias** em `EM_AQUECIMENTO`/`AQUECIDO` aguardando envios externos
- **984 contatos ativos** na pool externa + 7 âncoras (celulares pessoais) prontos
- **Último envio: hoje 10:00 UTC** (07h BRT) — apenas 29 envios em 24h, todos disparos manuais residuais
- Sem cron, os chips ficam presos no cluster fechado IA-IA, exatamente o oposto do objetivo

## Objetivo

Reativar o cron do autosave para que **cada uma das 43 instâncias envie 1-7 mensagens/dia** para números externos (70% âncoras, 30% pool de 985), quebrando o cluster fechado.

## Plano

### 1. Criar cron job `aquecimento-autosave-horario`

Migração SQL agendando a função 1x por hora, das **08h às 20h BRT** (11-23 UTC), mesma janela do ping-pong para máxima economia:

```text
schedule: '0 11-23 * * *'  → 13 execuções/dia
target:   /functions/v1/aquecimento-envio-autosave
```

A própria função já tem proteções internas: respeita 07-21h BRT, pula 12-14h (almoço), aplica fator fim-de-semana (sáb 60%, dom 40%), respeita limite diário por fase (3-7 msg/instância) e faz rodízio justo entre âncoras.

### 2. Estimativa de custo

| Item | Cálculo | Custo/mês |
|---|---|---|
| Invocações Edge | 13 exec/dia × 30 = 390/mês | ~US$ 0,02 |
| Compute (Promise.all 43 instâncias, ~5-15s) | ~390 × 10s | ~US$ 0,15 |
| DB writes (~100-300 inserts/dia em `aquecimento_envios_autosave` + updates pool) | ~6.000/mês | ~US$ 0,10 |
| UAZAPI calls | externos (sem custo Lovable) | R$ 0 |

**Total estimado: ~US$ 0,30 a 0,80/mês** (muito barato — sem IA, é só HTTP POST)

Custo somado com o que já roda: **~US$ 3,30 a 5,80/mês total** (dentro da faixa econômica aprovada).

### 3. Validação após aplicar

- Disparar manualmente pelo botão "Disparar ciclo agora" na aba Auto-Save para confirmar
- Verificar em 1-2h se contador "Envios Hoje" sobe naturalmente
- Conferir distribuição 70/30 âncoras/pool no JSON de retorno

## O que NÃO será reativado

Mantidos desligados (economia): `process-whatsapp-queue`, `process-acionamento-agendado`, `daily-report-aquecimento-20h`, `cleanup-inbox-media-daily`, `ai-budget-monitor`. Reativar só sob pedido específico.
