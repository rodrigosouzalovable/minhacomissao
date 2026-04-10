

## Duas correções para o Acionamento

### Problema 1: Mensagens não aparecem no Inbox
O envio automático pelo Acionamento usa o hook `useAutoSend`, que já passa `instancia_id` corretamente para `send-whatsapp`. Porém, os **agendamentos offline** (`process-acionamento-agendado`) salvam no inbox usando `server_url`/`instance_token` para resolver o `instancia_id`, mas não passam o `instancia_id` da tabela `user_whatsapp_instances` diretamente. Além disso, o contato pode não ser encontrado porque a Edge Function não faz matching por sufixo (últimos 8 dígitos) — ela salva com o telefone formatado completo, que pode divergir do formato do contato existente.

**Correção**: Na Edge Function `process-acionamento-agendado`, ao salvar no inbox, usar matching por sufixo (últimos 8 dígitos) para localizar o contato correto e salvar com o formato exato do telefone dele — mesma lógica que `send-whatsapp` já implementa. Também atualizar o contato (`ultima_mensagem`, `ultima_mensagem_em`) ou criar um novo se não existir.

### Problema 2: Indicador de progresso no sidebar
Atualmente, o `useAutoSend` já expõe `autoProgress` com `{ current, total }`, mas o `AppLayout` não o consome. O padrão já existe para Campanhas de Voz via `statusBadge` no `SortableNavItem`.

**Correção**: No `AppLayout`, importar `useAutoSend` e adicionar o `statusBadge` no item `/acionamento` mostrando `current/total` quando `autoSending` estiver ativo.

### Arquivos a modificar

1. **`src/components/layout/AppLayout.tsx`**
   - Importar `useAutoSend`
   - Adicionar `statusBadge` para `/acionamento` quando `autoSending && autoProgress`
   - Formato: `${autoProgress.current}/${autoProgress.total}`

2. **`supabase/functions/process-acionamento-agendado/index.ts`**
   - Ao salvar mensagem no inbox, adicionar matching por sufixo (últimos 8 dígitos) para localizar contato existente
   - Usar o formato de telefone exato do contato encontrado
   - Criar/atualizar contato na tabela `whatsapp_contatos`

