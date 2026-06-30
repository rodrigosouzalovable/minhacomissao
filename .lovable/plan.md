## Plano

### 1. Badge vermelho na sidebar "Inbox Meta Oficial"
- Em `src/components/AppLayout.tsx` (ou onde está o sidebar), localizar item "Inbox Meta Oficial" e adicionar contador igual ao do "WhatsApp Inbox".
- Criar hook `useMetaInboxUnreadCount` que:
  - Consulta `meta_whatsapp_contatos` somando `nao_lidas > 0` (ou `meta_whatsapp_mensagens` com `lida=false` e `direction='inbound'`).
  - Inscreve Realtime em `meta_whatsapp_mensagens` para atualizar live.
- Renderiza bolinha vermelha com o número, idêntica ao estilo do WhatsApp Inbox (referência da imagem 2).

### 2. Garantir que TODA mensagem (enviada e recebida) apareça no Inbox Meta
- Recebidas: webhook `meta-whatsapp-webhook` já insere — confirmar que insere também mídias (image/audio/document/video/sticker/button/interactive) em `meta_whatsapp_mensagens` com `direction='inbound'`. Ajustar caso esteja filtrando só `text`.
- Enviadas:
  - Texto livre (`send-whatsapp-meta-text`): já insere com `direction='outbound'` — confirmar.
  - Templates (envio em massa Meta e teste individual): garantir que cada envio bem-sucedido faça `INSERT` em `meta_whatsapp_mensagens` (direction='outbound', tipo='template', preview com nome do template + parâmetros renderizados) e crie/atualize contato em `meta_whatsapp_contatos`.
  - Status callbacks (sent/delivered/read/failed) atualizam o `status` da linha via `wamid`.
- InboxMeta.tsx: marcar mensagens como lidas (`nao_lidas=0` no contato) ao abrir a conversa, para o badge zerar.

### 3. UI InboxMeta
- Confirmar que a lista de contatos mostra última mensagem (inbound ou outbound) ordenada por `updated_at` desc.
- Conversa aberta exibe histórico completo (inbound à esquerda, outbound à direita com check-marks de status).

### Arquivos a alterar
- `src/components/AppLayout.tsx` — badge sidebar.
- `src/hooks/useMetaInboxUnreadCount.ts` — novo hook.
- `src/pages/InboxMeta.tsx` — marcar como lida ao abrir; garantir render de todos os tipos.
- `supabase/functions/meta-whatsapp-webhook/index.ts` — cobrir todos os tipos de mensagem inbound.
- `supabase/functions/send-whatsapp-meta-text/index.ts` — confirmar insert outbound.
- `supabase/functions/send-meta-whatsapp-template/index.ts` (ou equivalente do envio em massa) — inserir outbound + upsert contato.

Pronto para executar?
