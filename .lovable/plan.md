## Diagnóstico

Estado atual confirmado no banco:
- **157 instâncias** EM_AQUECIMENTO, 20 PAUSADAS, 0 AQUECIDAS
- Hoje, **apenas 18 instâncias conversaram** (23 interações totais, média 0.13)
- Cron `aquecimento-auto-diario` roda **a cada 2 horas** (`0 10-22/2 * * *`) — só ~7 ciclos por dia

### Por que está lento

Três gargalos no `whatsapp-aquecimento/index.ts`:

1. **Cron muito espaçado**: 1 ciclo a cada 2h = no máximo 7 ciclos/dia entre 7h-21h.
2. **Target diário sorteado baixíssimo**: cada instância tem meta de 1-3 conversas/dia (50% chance = só 1).
3. **MAX_PAIRS_PER_CYCLE = 3**: cada execução processa no máximo **3 pares** (6 instâncias). Com 157 instâncias precisaria de ~26 ciclos só para tocar todas uma vez. Em 7 ciclos/dia = só 21 instâncias contempladas/dia.
4. **Delay interno de 30-120s entre pares** dentro do mesmo ciclo.

Resultado: matematicamente impossível todas as 157 instâncias conversarem no mesmo dia.

---

## Plano de aceleração

Objetivo: **garantir que todas as ~157 instâncias conversem pelo menos 1× por dia**, mantendo padrão anti-ban (delays aleatórios, pausa de almoço, redução fim de semana).

### 1. Aumentar frequência do cron (de 2h para 30min)

Alterar `aquecimento-auto-diario` de `0 10-22/2 * * *` para `*/30 7-23 * * *` (a cada 30min entre 7h-21h BRT). Isso passa de 7 → 28 ciclos/dia.

### 2. Aumentar pares por ciclo (de 3 para 12)

Em `whatsapp-aquecimento/index.ts`: `MAX_PAIRS_PER_CYCLE = 3` → **`12`**. 28 ciclos × 12 pares = 336 pares/dia ≫ 157 instâncias necessárias para cobrir todas (com folga).

### 3. Priorizar instâncias que ainda não conversaram hoje

Hoje a função embaralha aleatoriamente. Vou adicionar **ordenação por `interacoes_hoje ASC`** antes do embaralhamento parcial, garantindo que quem tem 0 interações hoje seja escolhido primeiro. Mantém afinidade de 30% com último parceiro só entre instâncias já com interações.

### 4. Reduzir delay entre pares no mesmo ciclo

Atual: `30000 + Math.random() * 90000` (30-120s). Novo: **`8000 + Math.random() * 15000`** (8-23s). Com 12 pares × ~15s = ~3min por ciclo, ainda confortável dentro da janela de 30min do cron.

### 5. Garantir target mínimo de 1/dia (já implementado)

O código já força `Math.max(1, ...)` no target. Mantém. A combinação dos itens 1-3 garante que o sistema consiga **cumprir** esse mínimo para todos.

### 6. Aviso de custo Lovable Cloud

Esta mudança aumenta execuções de Edge Function de ~7/dia para ~28/dia (4×) e chamadas UAZAPI proporcionalmente. **Estimativa: +3 a +5% no consumo mensal de Cloud.** Compensa porque acelera o aquecimento de semanas para dias.

---

## Detalhes técnicos

**Arquivos afetados:**
- `supabase/functions/whatsapp-aquecimento/index.ts`:
  - `MAX_PAIRS_PER_CYCLE`: 3 → 12
  - Delay entre pares: 30-120s → 8-23s
  - Adicionar sort por `interacoes_hoje ASC` antes do pareamento
- **Cron job** `aquecimento-auto-diario`: reagendar para `*/30 7-23 * * *` via `cron.unschedule` + `cron.schedule` (tabela `cron.job`, executado por SQL com a service role).

**Sem novas tabelas, sem novas funções.** Apenas ajustes de configuração e parâmetros.

**Resultado esperado em 24h após deploy:**
- ~157 instâncias com pelo menos 1 interação/dia (vs. 18 hoje)
- ~280-330 conversas iniciadas/dia (vs. ~25 hoje)
- Tempo até primeiras instâncias atingirem Fase 2: cai de ~3 semanas para ~7 dias.
