## Diagnóstico

Confirmei via banco + logs:

- **Envio outbound OK**: nosso template "Atendente Yasmim" saiu da instância **Novo Mundo 3144** (`b103ac3e`, phone_number_id `892959203899506`) às 11:56 UTC. Registrado em `meta_whatsapp_mensagens`.
- **Resposta "Sim" da cliente NÃO existe no banco**: nenhuma linha `direcao='entrada'` para `5563992170160`. O contato dela nessa instância tem `ultima_msg_entrada_em = NULL`.
- **Webhook não recebeu o evento**: nos logs de `meta-whatsapp-webhook` do phone_number_id `892959203899506` só aparecem eventos `messages: 0, statuses: 1` (ACKs de entrega). Nenhum `messages: 1` no horário 11:56–12:00 UTC. A Meta simplesmente não entregou o webhook de inbound dessa resposta — apesar de a mesma instância ter recebido inbound de outra cliente às 12:48 UTC (Larissa), o que prova que a subscription base está viva mas eventos individuais estão sendo perdidos.

Isso não é bug do nosso parser: o payload nunca chegou. É o mesmo padrão do caso anterior (Maria Jose). A Meta ocasionalmente falha ao entregar webhooks de `messages` e não repete indefinidamente. Precisamos de defesa em profundidade.

## Correção

### 1. Reconciliador de conversas (novo — resolve a raiz do problema)
Nova edge function `meta-inbox-reconciliar` rodando a cada **5 min via `pg_cron`**:

Para cada instância Meta ativa, listar conversas onde:
- houve outbound nas últimas 48h; **E**
- `ultima_msg_entrada_em` está NULL ou é anterior ao último outbound.

Para cada uma, chamar `GET /{phone_number_id}/messages?since={ts}` da Graph API (Cloud API 2026 suporta leitura de conversation history via `/conversations` — usar o endpoint disponível na versão da WABA; caso a WABA não exponha history read, usar o fallback abaixo).

**Fallback quando a Graph não expõe history**: consultar `/{waba_id}/conversation_analytics` que devolve contagem de conversas por período — se detectar `user_initiated` > registrado, disparar alerta ao admin para reabrir manualmente com template UTILITY.

Cada mensagem retornada que não existe (via `wa_message_id`) é inserida com o mesmo pipeline do webhook (upsert contato, auto-etiqueta por acordo, incrementa `nao_lido`).

### 2. Health check de subscription (impede o próximo caso)
Nova edge function `meta-webhook-health` rodando **diariamente 03:00 BRT**:
- Para cada `waba_id` único, chama `GET /{waba_id}/subscribed_apps` e valida que nosso app está inscrito no campo `messages`.
- Se ausente, reinscreve automaticamente e alerta admin (62991672674) via WhatsApp com o nome da instância.
- Grava resultado em novas colunas `meta_whatsapp_instances.webhook_status TEXT` + `webhook_ultima_verificacao TIMESTAMPTZ`.

### 3. Banner de risco na conversa
No `InboxMeta.tsx`, para conversas onde já existe outbound recente sem inbound e o cliente **respondeu no dispositivo** (detectado pela reconciliação da etapa 1), exibir na conversa um chip "🔄 Recuperado via reconciliação" na primeira mensagem restaurada, para o atendente saber que veio pelo caminho de fallback e não pelo webhook direto.

### 4. Card "Saúde do Webhook" em `ConfigurarMeta.tsx`
Por instância, mostrar:
- Última mensagem inbound recebida.
- Status da subscription (`webhook_status`).
- Botão "Reinscrever agora" (dispara `meta-webhook-health` só para aquela instância).

## Escopo técnico

- **Novas edge functions**: `supabase/functions/meta-inbox-reconciliar/index.ts`, `supabase/functions/meta-webhook-health/index.ts`
- **Migration**: colunas `webhook_status`, `webhook_ultima_verificacao` em `meta_whatsapp_instances`
- **pg_cron**: 
  - `meta-inbox-reconciliar` a cada 5 min
  - `meta-webhook-health` diário 06:00 UTC (03:00 BRT)
- **UI edits**: `src/pages/ConfigurarMeta.tsx` (card de saúde), `src/pages/InboxMeta.tsx` (chip "Recuperado")

## O que NÃO vou fazer
- Não vou mexer no motor de envio nem no `envio-meta-massa-burst`.
- Não vou recuperar retroativamente as mensagens da Yasmin e da Maria Jose antes do primeiro tick do reconciliador — mas o primeiro tick, ao rodar após o deploy, já vai buscar as últimas 48h e pegá-las se a Graph expuser o histórico.
- Não vou remover o filtro anti-espelho do webhook (ele protege contra loops entre instâncias oficiais).

## Ação manual imediata (enquanto o plano não é aprovado)
Para a Yasmin agora: **responder pelo Inbox só após ela responder de novo** ou **reabrir com template UTILITY** (a janela de 24h está aberta no lado dela, mas o nosso sistema não sabe — a reconciliação vai corrigir isso quando implantada).
