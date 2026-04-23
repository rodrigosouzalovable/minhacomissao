

## Diagnóstico do consumo: $8,28 → $0 em poucas horas

Investigui os logs e encontrei a causa exata:

### O que está consumindo

**TODAS as 500 invocações mais recentes da edge function são `whatsapp-chatbot`.** O webhook está sendo chamado para CADA mensagem que chega nas suas instâncias — incluindo grupos lotados como **"VÍDEOS🇧🇷RISOS"** (3.715 mensagens não lidas), correntes de vídeos, reações, etc.

Exemplo real do log: a UAZAPI mandou um webhook por causa de 1 vídeo de 4MB num grupo com `chatid: 120363161516933576@g.us`. Isso multiplicado por dezenas de grupos × dezenas de mensagens/hora × várias instâncias = **milhares de invocações cobradas por hora**.

### Por que o filtro atual não economiza

A função TEM um filtro em `if (isGroup) return ignored` na linha 857 — mas a invocação **já foi cobrada** quando a UAZAPI chama o endpoint. O filtro só impede o processamento, não o custo da invocação em si.

**O autosave NÃO é o culpado** (apenas 3 envios em 24h, custo desprezível).

### Correção (corte imediato do gasto)

**1. Desativar o webhook da UAZAPI para mensagens de GRUPO em todas as instâncias**
A UAZAPI tem configuração por instância para escolher quais eventos disparam webhook. Vou criar uma rotina que chama o endpoint `/instance/updateWebhook` da UAZAPI para cada instância conectada e desativa os eventos de grupo + reações + protocolMessage. Isso para o webhook na origem — zero invocações cobradas.

**2. Adicionar early-return ainda mais agressivo na edge function**
Como segundo escudo, mover o filtro para a primeira linha após o `serve()`, antes de qualquer parse pesado de payload, para o caso de webhooks de grupo passarem.

**3. Filtrar também `EventType` que não interessam**
O log mostrou `EventType:"messages"` carregando vídeos de 4MB. Vou rejeitar payloads onde `mediaType === 'video'` em chats não-cadastrados (sem acordo/devedor associado), já que não usamos vídeos no fluxo de cobrança.

**4. Botão "Pânico" no Monitor de Envios**
Adicionar botão admin que desativa instantaneamente TODOS os webhooks de TODAS as instâncias UAZAPI — para você usar caso volte a sangrar saldo no futuro.

### Impacto esperado

| Item | Antes | Depois |
|---|---|---|
| Invocações chatbot/dia | ~50.000+ (estimativa pelos logs) | ~500 (só msgs reais de cobrança) |
| Custo Cloud/dia | ~$3-8 | < $0,20 |
| Funcionalidade real perdida | nenhuma — grupos nunca foram processados mesmo |

### Ações imediatas após aprovar

1. Migração SQL: criar tabela `uazapi_webhook_config` para registrar quais eventos cada instância escuta
2. Edge function nova `uazapi-disable-group-webhooks` que itera todas instâncias conectadas e chama UAZAPI para remover eventos `messages.upsert` de grupos
3. Disparar essa função 1x agora para parar o sangramento
4. Atualizar `whatsapp-qr` para que NOVAS instâncias já sejam criadas com webhook restrito (só DM, sem grupos)
5. Hardening do filtro em `whatsapp-chatbot/index.ts`

### Custo Lovable Cloud do plano
Zero. A correção REDUZ custo drasticamente (~95% menos invocações). Sem novas tabelas grandes, sem IA.

### Fora de escopo
- Não mexo no autosave (está custando $0)
- Não mexo no Inbox para você ver mensagens reais
- Não removo nada do fluxo de cobrança real (DMs continuam funcionando 100%)

