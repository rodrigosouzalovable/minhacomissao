

## Plano: Central de WhatsApp (Inbox Unificado) — V1

Sim, com este plano você poderá ver todas as mensagens recebidas em tempo real e responder diretamente pela interface. A resposta será enviada pelo WhatsApp do número correspondente usando a infraestrutura UAZAPI já existente.

### Como funciona o fluxo completo

```text
Cliente envia msg → UAZAPI Webhook → whatsapp-chatbot (já existe)
                                        ↓ NOVO: salva na tabela whatsapp_mensagens
                                        ↓ Supabase Realtime → UI atualiza instantaneamente

Você responde no Inbox → Frontend chama send-whatsapp (já existe) → UAZAPI → WhatsApp do cliente
                           ↓ NOVO: salva na tabela whatsapp_mensagens (direção: saída)
```

Custo adicional praticamente zero — reutiliza as Edge Functions que já são chamadas.

---

### Etapa 1 — Criar tabelas (migration)

**`whatsapp_mensagens`**: histórico de todas as mensagens
- `id`, `instancia_id` (ref `user_whatsapp_instances`), `telefone_remoto`, `nome_contato`, `conteudo` (texto), `direcao` (entrada/saida), `timestamp_msg`, `lida` (boolean), `criado_em`
- Índices em `(instancia_id, telefone_remoto)` e `timestamp_msg`
- Habilitar Realtime
- RLS: admins veem tudo; usuários autenticados veem mensagens das instâncias que possuem

**`whatsapp_contatos`**: cache de contatos para lista lateral
- `id`, `instancia_id`, `telefone`, `nome`, `ultima_mensagem`, `ultima_mensagem_em`, `nao_lido` (int), `criado_em`
- Unique constraint em `(instancia_id, telefone)`
- RLS: mesma lógica

### Etapa 2 — Modificar `whatsapp-chatbot/index.ts`

Após extrair `telefone` e `texto` do webhook (e antes do processamento de etapas do chatbot), adicionar:
- Filtro: ignorar se `remoteJid` contém `@g.us` (já existe)
- INSERT na `whatsapp_mensagens` com `direcao = 'entrada'`
- UPSERT na `whatsapp_contatos` (atualizar última msg, incrementar `nao_lido`)
- Capturar também mensagens `fromMe = true` como `direcao = 'saida'`

Isso é adicionado no início do handler, antes da lógica do chatbot, para que todas as mensagens sejam salvas independente do processamento.

### Etapa 3 — Modificar `send-whatsapp/index.ts`

Após envio bem-sucedido via UAZAPI:
- Receber `instancia_id` opcional no body
- INSERT na `whatsapp_mensagens` com `direcao = 'saida'`
- UPSERT na `whatsapp_contatos`

### Etapa 4 — Criar página `WhatsAppInbox.tsx`

Layout estilo WhatsApp Web com dois painéis:

**Painel esquerdo** (lista de conversas):
- Busca por nome/telefone
- Filtro por instância (dropdown com números conectados)
- Lista de contatos ordenada por última mensagem
- Badge de não lidos
- Indicador visual de qual instância/número

**Painel direito** (chat ativo):
- Histórico de mensagens com scroll infinito (carrega 50 por vez)
- Balões de mensagem estilo WhatsApp (entrada à esquerda, saída à direita)
- Campo de texto + botão enviar
- Indicador de qual número está respondendo
- Marcar como lido ao abrir conversa

Realtime subscription para atualizar mensagens e contatos em tempo real.

### Etapa 5 — Rota e navegação

- Adicionar rota `/inbox` protegida (admin only inicialmente)
- Novo item no menu lateral: "WhatsApp Inbox" com ícone `MessageSquare`
- Adicionar à lista de `navItems` no `AppLayout.tsx`

### Etapa 6 — Marcar como lido

- Ao abrir uma conversa, zerar `nao_lido` no `whatsapp_contatos`
- Atualizar `lida = true` nas mensagens de entrada daquele contato

---

### Detalhes técnicos

- Sem nova Edge Function — reutiliza `whatsapp-chatbot` (recepção) e `send-whatsapp` (envio)
- Sem polling — Supabase Realtime (custo zero adicional)
- V1 apenas texto (sem mídia/áudio)
- Paginação: últimas 50 mensagens por conversa, lazy-load ao scrollar para cima
- Grupos ignorados pelo filtro `@g.us` já existente

