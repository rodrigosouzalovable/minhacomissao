

## Plano: Compartilhar WhatsApp Inbox com Funcionários

### Problema atual
O Inbox filtra instâncias por `user_id = auth.uid()`, então cada usuário só vê suas próprias instâncias. As políticas RLS de `whatsapp_contatos` e `whatsapp_mensagens` também restringem acesso às instâncias do próprio usuário. Mesmo que o admin libere a aba `/inbox` nas permissões, a funcionária não verá nenhuma conversa porque não possui instâncias próprias.

### Solução
Adicionar uma flag `inbox_compartilhado` na tabela `user_permissions`. Quando ativada pelo admin, o funcionário verá **todas** as instâncias e conversas no Inbox, podendo acompanhar e responder.

### O que será feito

**1. Migration: adicionar coluna e atualizar RLS**
- Adicionar coluna `inbox_compartilhado` (boolean, default false) na tabela `user_permissions`
- Criar função auxiliar `has_inbox_compartilhado(uuid)` (SECURITY DEFINER) que verifica se o usuário tem a flag ativa
- Adicionar políticas RLS nas 3 tabelas:
  - `user_whatsapp_instances`: SELECT para usuários com inbox compartilhado
  - `whatsapp_contatos`: SELECT e UPDATE para usuários com inbox compartilhado
  - `whatsapp_mensagens`: SELECT e UPDATE para usuários com inbox compartilhado

**2. Atualizar `EditPermissionsDialog.tsx`**
- Adicionar um Switch "Inbox Compartilhado" abaixo do "Visível no Ranking"
- Salvar/ler o campo `inbox_compartilhado` junto com as demais permissões

**3. Atualizar `WhatsAppInbox.tsx`**
- Se o usuário for admin OU tiver `inbox_compartilhado = true`, buscar TODAS as instâncias ativas (sem filtro de `user_id`)
- Caso contrário, manter o comportamento atual (só instâncias próprias)

**4. Atualizar `useUserPermissions.tsx`**
- Expor o campo `inboxCompartilhado` no hook para uso no Inbox

**5. Atualizar `AppLayout.tsx`**
- Ajustar a contagem de não-lidos no badge do menu lateral para também considerar todas as instâncias quando o usuário tiver inbox compartilhado

### Detalhes técnicos

Arquivos afetados:
- Nova migration SQL
- `src/components/EditPermissionsDialog.tsx`
- `src/pages/WhatsAppInbox.tsx`
- `src/hooks/useUserPermissions.tsx`
- `src/components/layout/AppLayout.tsx`

A flag é por usuário, controlada exclusivamente pelo admin. Não expõe dados sensíveis (tokens) — a funcionária vê contatos e mensagens mas não as credenciais das instâncias. O envio de mensagens funcionará normalmente porque o Inbox já usa `server_url` e `instance_token` da instância selecionada (que virá do SELECT permitido pela RLS).

