## Diagnóstico: o que está consumindo Cloud agora

Levantei o consumo real das **últimas 24h** via logs de Edge Functions:

| Função | Chamadas/24h | Tempo médio | Problema |
|---|---|---|---|
| `whatsapp-chatbot` (webhook UAZAPI) | **3.405** | 67ms | Recebe milhares de mensagens de **grupos/broadcast** e só faz `Ignored` — gasta boot + execução à toa |
| `test-uazapi-connection` | **1.959** | **414ms** | Chamada **1× por instância** (são 103 ativas!) toda vez que alguém abre Inbox / Acionamento / Campanhas Voz / Lembretes |
| Outras | ~2 | — | Insignificante |

**Total: ~5.400 invocações/dia, ~17 min de CPU**, dominado por dois vilões. Crons rodando muito frequente também contribuem.

## Plano de cortes (do mais barato para o mais técnico)

### 1. Bloquear webhooks de grupo na UAZAPI (corta ~3.400 chamadas/dia)

Sua memória já diz *"Never load group messages"*, e o código de fato ignora — mas a função **boota e executa** mesmo assim. A função `uazapi-disable-group-webhooks` já existe. Vou:

- Rodá-la em **todas as 103 instâncias ativas** uma vez para reconfigurar webhooks na UAZAPI excluindo grupos/broadcast desde a origem.
- Adicionar uma flag no `whatsapp-qr` para nunca registrar webhook de grupos em novas conexões (já está, mas vou validar).

**Ganho esperado:** −60% das invocações totais.

### 2. Cachear status de conexão das instâncias (corta ~1.700 chamadas/dia)

Hoje `test-uazapi-connection` é chamada **1× por instância** ao abrir 4 páginas diferentes. Com 103 instâncias = 103 chamadas a cada abertura.

Vou:

- Criar um cache em memória (sessionStorage) por instância com **TTL de 5 minutos**. Se o status foi checado nos últimos 5 min, reusa.
- Em **`PaymentReminders.tsx`**, **`CampanhasVoz.tsx`** e **`WhatsAppInbox.tsx` (diálogo nova conversa)** → usar cache.
- Em **`Acionamento.tsx`** → manter o check no carregamento, mas com cache de 5 min entre re-renders.
- Remover o **polling de 60s** em `WhatsAppInbox.tsx` (linha 270) que tenta importar histórico — substituir por **1 tentativa única** (já é idempotente).

**Ganho esperado:** −80% das chamadas de `test-uazapi-connection`.

### 3. Reduzir frequência de crons não-críticos (corta ~50% do consumo de cron)

Hoje:
- `process-acionamento-agendado-v2`: a cada 10 min (10h–23h) = **84×/dia**
- `process-whatsapp-queue-10min`: a cada 10 min = **84×/dia**
- `aquecimento-auto-diario`: a cada 30 min = **48×/dia**
- `ai-budget-monitor-30min`: a cada 30 min = **48×/dia**

Proposta:
- `process-acionamento-agendado-v2` → **a cada 15 min** (de 10h às 22h) = 48×/dia
- `process-whatsapp-queue-10min` → **a cada 15 min** = 48×/dia
- `ai-budget-monitor-30min` → **a cada 60 min** = 24×/dia (suficiente, monitor)
- `aquecimento-auto-diario` → manter (é o coração do anti-ban)

**Ganho esperado:** −150 invocações/dia + menos compute do banco.

### 4. Confirmar antes de executar

Antes de mexer eu vou pedir sua confirmação explícita em **3 itens** que afetam comportamento visível:
- (a) Reconfigurar webhook das 103 instâncias (uma vez, 5–10 min).
- (b) Cache de 5 min no status de conexão (você verá um indicador "verificado há X min" se preferir).
- (c) Reduzir frequência dos crons listados acima.

## O que NÃO vou mexer (para não quebrar nada)
- Lembretes automáticos das 09:20 BRT — segue intacto.
- Aquecimento (07h–21h ping-pong) — segue intacto.
- Realtime do Inbox, fluxo de envio de WhatsApp manual.
- Dashboards, comissões, financeiro — sem impacto.

## Detalhe técnico (resumo)

```text
Arquivos a alterar (frontend):
  src/pages/WhatsAppInbox.tsx       — remover polling 60s, usar cache
  src/pages/CampanhasVoz.tsx        — usar cache
  src/components/PaymentReminders.tsx — usar cache
  src/pages/Acionamento.tsx         — usar cache nas 2 chamadas
  src/lib/uazapiConnectionCache.ts  — NOVO (cache em memória + sessionStorage TTL 5min)

Backend:
  Migration: UPDATE cron.job SET schedule = ... (3 jobs)
  Invocação manual: uazapi-disable-group-webhooks p/ cada instância ativa
```

## Ordem de execução proposta
1. Criar cache + atualizar 4 arquivos frontend → corte imediato no polling.
2. Migration para reagendar 3 crons.
3. Script único para chamar `uazapi-disable-group-webhooks` em todas as 103 instâncias.
4. Monitorar 24h e reportar nova baseline.

**Estimativa de redução total:** ~70–80% das invocações de Edge Functions e proporcionalmente do consumo Cloud.

Aprovar para eu executar?