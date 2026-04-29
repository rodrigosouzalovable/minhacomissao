## Objetivo

Ajustar a importação automática de histórico do WhatsApp recém-implementada para:
1. Rodar **apenas para o admin** (você) — instâncias conectadas por funcionários não disparam o sync.
2. Reduzir de **20 → 10 mensagens** por conversa, economizando custos de inserts e chamadas UAZAPI.

## Mudanças

### 1. `src/pages/WhatsAppInbox.tsx`
- Importar o hook `useUserRole` que já existe no projeto.
- No `useEffect` de auto-import (linhas ~211-272), adicionar guarda no início:
  ```ts
  if (!isAdmin) return;
  ```
- Adicionar `isAdmin` ao array de dependências do `useEffect`.

Resultado: funcionários que conectam WhatsApp não disparam mais a importação automática.

### 2. `supabase/functions/import-recent-whatsapp-chats/index.ts`
- Alterar a constante de profundidade de mensagens (atualmente `20`) para `10`.
- Mantém toda a lógica de filtros (sem grupos, sem status, sem broadcast), deduplicação e marcação `lida = false`.

## O que NÃO muda

- Estrutura da tabela `user_whatsapp_instances` (coluna `historico_inicial_importado_em` continua igual).
- Trigger de polling de 60s, verificação de conexão via `test-uazapi-connection`, idempotência via flag no banco.
- Comportamento do botão manual (se houver) e regras de filtro de grupos/status.
- Funcionários ainda podem usar o Inbox normalmente — só não recebem o sync automático histórico.

## Arquivos a editar

- `src/pages/WhatsAppInbox.tsx` — adicionar guarda `isAdmin`.
- `supabase/functions/import-recent-whatsapp-chats/index.ts` — trocar 20 por 10.
