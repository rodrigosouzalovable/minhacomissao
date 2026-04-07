

# Plano de Implementação — Correções Anti-Ban do Aquecimento WhatsApp

## Visão Geral

Seis mudanças no arquivo `whatsapp-aquecimento/index.ts`, uma no `process-acionamento-agendado/index.ts`, uma no `AquecimentoConfigTab.tsx`, e uma migração de banco de dados. Foco em reduzir detecção de automação sem criar tabelas desnecessárias.

---

## Decisão de Escopo

Algumas funcionalidades propostas (números âncora, entrada em grupos públicos, interação com bots públicos) dependem de endpoints da UAZAPI que precisam ser validados primeiro (`/group/join`, etc.) e envolvem chips externos físicos. Essas serão tratadas como **fase 2** futura. Este plano foca nas correções que podem ser feitas 100% em código agora.

---

## Mudanças

### 1. Jitter no início da Edge Function
**Arquivo:** `whatsapp-aquecimento/index.ts`
- Adicionar delay aleatório de 0-180 segundos no início da execução (antes de qualquer lógica)
- Isso quebra o padrão de execução exata a cada 15 minutos

### 2. Pausa de almoço (12h-14h)
**Arquivo:** `whatsapp-aquecimento/index.ts`
- Após calcular a hora SP, verificar se `hour >= 12 && hour < 14`
- Se sim, retornar sem fazer nada (skip do ciclo)

### 3. Probabilidade de skip (30%) e variação de fim de semana
**Arquivo:** `whatsapp-aquecimento/index.ts`
- Após selecionar a instância elegível, adicionar 30% de chance de pular o envio de mensagem
- Sábado: usar `Math.floor(limite * 0.6)` como limite efetivo
- Domingo: usar `Math.floor(limite * 0.4)` como limite efetivo
- "Read-only days" (15%): nova função determinística similar a `isSilentDay`, mas em vez de pular tudo, pula apenas mensagens (mantém status e contatos)

### 4. Pool de imagens por instância (Lorem Picsum)
**Arquivo:** `whatsapp-aquecimento/index.ts`
- Substituir as 30 URLs fixas do Unsplash por URLs dinâmicas do Lorem Picsum
- Gerar URL única por instância+dia: `https://picsum.photos/seed/${hash}/800/600`
- Cada número terá imagens diferentes, eliminando o fingerprint de hash compartilhado
- Manter o pool de Unsplash como fallback caso Picsum falhe

### 5. Burst matinal (30% dos dias)
**Arquivo:** `whatsapp-aquecimento/index.ts`
- Função determinística `isBurstMorning(instanceId, dateStr)` — 30% dos dias
- Se ativo e hora entre 8-9h: enviar até 2-3 mensagens com delay curto (30-60s)
- Após o burst, a instância não envia mais até 11h (cooldown de 2-3h)

### 6. Corrigir alinhamento de configurações do painel
**Arquivo:** `src/components/aquecimento/AquecimentoConfigTab.tsx`
- Atualizar `DEFAULTS.limites_por_fase` de `{ 1: 5, 2: 10, 3: 20, 4: 30, aquecido: 50 }` para `{ 1: 1, 2: 3, 3: 7, 4: 15, aquecido: 25 }`
- Atualizar labels para mostrar 5 fases (remover "aquecido" separado, usar Fase 5)
- Adicionar novos campos de configuração: "Redução fim de semana (%)" e "Pausa almoço"

### 7. Limitar envio diário no acionamento agendado (já 80, manter)
**Arquivo:** `process-acionamento-agendado/index.ts`
- Já implementado com `MAX_MSGS_PER_INSTANCE_PER_DAY = 80`. Sem mudança necessária.

### 8. Migração: coluna `tipo` na tabela `user_whatsapp_instances`
- Adicionar coluna `tipo VARCHAR(20) DEFAULT 'NORMAL'` para preparar para números âncora futuros
- Não criar tabelas extras (`aquecimento_read_only_days`, `aquecimento_grupos`) por agora — a lógica de read-only days será determinística (sem persistência)

---

## Arquivos Editados

| Arquivo | Mudanças |
|---------|----------|
| `supabase/functions/whatsapp-aquecimento/index.ts` | Jitter, pausa almoço, skip 30%, fim de semana, read-only days, burst matinal, imagens Picsum |
| `src/components/aquecimento/AquecimentoConfigTab.tsx` | Alinhar defaults com PHASE_CONFIG real, adicionar campos novos |
| Migração SQL | `ALTER TABLE user_whatsapp_instances ADD COLUMN tipo VARCHAR(20) DEFAULT 'NORMAL'` |

---

## Resumo do Impacto na Segurança

| Antes | Depois |
|-------|--------|
| Execução exata a cada 15min | ±3min de jitter |
| Ativo 8h-18h sem pausa | Pausa de almoço 12h-14h |
| Todo dia envia se elegível | 30% skip + 15% read-only + 20% silencioso |
| Mesmas imagens para todos | Imagens únicas por instância/dia |
| Padrão igual seg-dom | Sábado 60%, Domingo 40% do limite |
| UI mostra limites errados | UI alinhada com código real |

