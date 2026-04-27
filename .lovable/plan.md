# Proteção de gastos da Lovable AI + alerta no WhatsApp

## Objetivo

Nunca mais deixar o saldo da Lovable AI ser consumido sem você saber. Vou criar **3 camadas de barreira** + **alertas automáticos no WhatsApp 62991672674**.

## Como vai funcionar

### Camada 1 — Limites diários rígidos (kill switch automático)

Nova tabela `ai_budget_config` com:
- `daily_limit_calls` (padrão: **500 chamadas/dia**)
- `daily_limit_chars` (padrão: **2.000.000 chars de prompt/dia** ≈ ~$2/dia)
- `hourly_limit_calls` (padrão: **100 chamadas/hora** — pega picos anormais)
- `alert_phone` = `62991672674`
- `alert_threshold_pct` = 70 (avisa em 70% e em 100%)

O helper `ai-guard.ts` (já existe) ganha uma checagem **antes de cada chamada**:
1. Conta chamadas/chars das últimas 24h e da última hora em `ai_usage_log`
2. Se passou de 70% → manda alerta WhatsApp (1x por dia, sem spam)
3. Se passou de 100% → **bloqueia a chamada** (igual ao kill switch global) e manda alerta de bloqueio
4. Reset automático no virar do dia (BRT)

### Camada 2 — Limite por função

Algumas funções gastam mais que outras. Tabela `ai_function_limits`:
- `whatsapp-mentor`: 50/dia
- `teach-chatbot`: 100/dia
- `gerar-estrategia-cobranca`: 30/dia
- demais: 50/dia (default)

Quando uma função estoura seu limite individual, é bloqueada **só ela** (resto continua funcionando).

### Camada 3 — Alerta WhatsApp

Nova edge function `ai-budget-alert` que envia para `62991672674` via UAZAPI usando uma das suas instâncias conectadas. Mensagens:

- **70%**: "⚠️ Lovable AI: 70% do limite diário usado (350/500 chamadas). Função top: whatsapp-mentor."
- **100% (bloqueio)**: "🚨 Lovable AI BLOQUEADA: limite diário atingido. Nenhuma chamada paga será feita até amanhã. Acesse /admin/ia-uso para liberar."
- **Função bloqueada**: "🛑 Função `teach-chatbot` bloqueada (atingiu 100/dia). Outras funções continuam ativas."

Tabela `ai_alerts_sent` para garantir que cada alerta vai 1x por dia (não floda seu WhatsApp).

### Camada 4 — Cron de monitoramento (a cada 30 min)

pg_cron chama `ai-budget-monitor` a cada 30 minutos para:
- Calcular consumo das últimas 24h
- Disparar alertas preventivos (caso o uso esteja acelerando)
- Bloquear automaticamente se passar do limite
- Registrar snapshot diário em `ai_daily_snapshot` (histórico)

## Painel `/admin/ia-uso` (extensão do existente)

Adicionar:
- Card "Orçamento diário": barra de progresso (chamadas + chars) com status verde/amarelo/vermelho
- Inputs para ajustar limites (chamadas/dia, chars/dia, telefone de alerta, % de alerta)
- Botão "Resetar contadores agora"
- Histórico dos últimos 30 dias (gráfico)
- Lista de alertas enviados

## Detalhes técnicos

**Migrations:**
- `ai_budget_config` (singleton, 1 linha) — limites globais e telefone
- `ai_function_limits` (function_name PK, daily_limit) — limites por função
- `ai_alerts_sent` (data + tipo de alerta) — anti-spam de WhatsApp
- `ai_daily_snapshot` (data PK, total_calls, total_chars, top_function) — histórico
- Cron job a cada 30 min chamando `ai-budget-monitor`
- Seed do telefone `62991672674` e limites padrão

**Edge Functions:**
- `_shared/ai-guard.ts` (modificar): adicionar `checkBudgetBeforeCall(functionName)` que retorna `{ allowed, reason }`. Todas as 13 funções já integradas chamam isso automaticamente — zero esforço de migração.
- `ai-budget-monitor` (nova): cron de 30 min que calcula uso, dispara alertas e atualiza snapshot
- `ai-budget-alert` (nova): envia mensagem WhatsApp via UAZAPI usando a instância principal conectada

**Frontend:**
- `src/pages/AdminAiUso.tsx`: adicionar seção "Orçamento e Alertas" com inputs editáveis e gráfico de histórico

## Resultado garantido

1. **Impossível** consumir mais que $2-3/dia sem você ser avisado
2. **Bloqueio automático** se algo sair do controle (não depende de você ver alerta)
3. **WhatsApp em tempo real** quando consumo passar de 70% ou bloquear
4. **Você ajusta limites pelo painel** sem precisar editar código
5. **Histórico de 30 dias** para análise de padrões

## Padrão default conservador

Se nada for ajustado, sistema vem travado em:
- **500 chamadas/dia** total
- **2M chars/dia** (~$2)
- **100 chamadas/hora** (anti-pico)
- Alerta em 70% e bloqueio em 100%

Você pode liberar mais ou apertar mais pelo `/admin/ia-uso`.
