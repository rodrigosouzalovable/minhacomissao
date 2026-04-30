## Causa raiz das mensagens duplicadas no Inbox

Olhando os dados do banco, todas as duplicatas (ex: "Aguardo", "Ok certo", "Sim consigo", "Certinho, já envio o boleto") foram inseridas com:
- O **mesmo `whatsapp_msg_id`** (ex: `3A392F6BEE422341CAEB`)
- `criado_em` separado por apenas 18-100 ms

Isso é um **race condition** entre webhooks do UAZAPI: o mesmo evento de mensagem chega 2x quase simultaneamente (eventos `messages.upsert` + `messages.update`, ou retransmissões), e o handler `whatsapp-chatbot` insere ambos porque:

1. Para mensagens **de entrada** (linha 1396 de `whatsapp-chatbot/index.ts`), não há **nenhuma verificação** de duplicidade — sempre faz `insert`.
2. Para mensagens **fromMe** (linha 1346), só dedup por janela de 30s + direção, sem checar `whatsapp_msg_id`. Pior: UAZAPI manda o mesmo ID com e sem prefixo do número (`3EB0B5AF...` vs `556282038967:3EB0B5AF...`), e dois eventos chegando em paralelo (~750ms entre si) escapam de qualquer dedup baseado em "select-then-insert" devido a race.
3. Não existe **UNIQUE constraint** em `whatsapp_mensagens` envolvendo `whatsapp_msg_id`, então o banco aceita as duas inserções concorrentes.

## Plano de correção

### 1. Migração: garantir unicidade no banco (defesa final atômica)

Criar índice único parcial em `(instancia_id, whatsapp_msg_id)` quando `whatsapp_msg_id IS NOT NULL`. Antes, normalizar IDs existentes removendo o prefixo `556...:` para tratar `556282038967:3EB0B5AF...` e `3EB0B5AF...` como o mesmo ID, e limpar duplicatas atuais (manter o registro mais antigo).

```sql
-- 1. Normalizar IDs existentes: remover prefixo "<numero>:" 
UPDATE whatsapp_mensagens
SET whatsapp_msg_id = split_part(whatsapp_msg_id, ':', 2)
WHERE whatsapp_msg_id ~ '^[0-9]+:';

-- 2. Apagar duplicatas (mantém a mais antiga por (instancia_id, whatsapp_msg_id))
DELETE FROM whatsapp_mensagens m
USING whatsapp_mensagens k
WHERE m.instancia_id = k.instancia_id
  AND m.whatsapp_msg_id = k.whatsapp_msg_id
  AND m.whatsapp_msg_id IS NOT NULL
  AND m.criado_em > k.criado_em;

-- 3. Índice único parcial
CREATE UNIQUE INDEX whatsapp_mensagens_msgid_unique
  ON whatsapp_mensagens (instancia_id, whatsapp_msg_id)
  WHERE whatsapp_msg_id IS NOT NULL;
```

### 2. `whatsapp-chatbot/index.ts` — dedup por `whatsapp_msg_id` (entrada e saída)

Substituir os dois `insert` (linhas 1363 e 1396) por:
- Normalizar `rawMessageId` removendo prefixo `^\d+:` antes de salvar.
- Trocar `insert` por `upsert` em `(instancia_id, whatsapp_msg_id)` com `ignoreDuplicates: true` quando houver `whatsapp_msg_id`.
- Manter o fallback atual (insert simples) só quando o webhook não trouxer ID.

Isso elimina o race condition mesmo com 2 webhooks paralelos: o índice único garante atomicidade.

### 3. `import-recent-whatsapp-chats/index.ts` — usar mesmo upsert

Hoje a importação histórica também faz `insert` puro com dedup só por chave composta de timestamp+conteúdo. Trocar por `upsert` com `onConflict: 'instancia_id,whatsapp_msg_id'` e normalizar o ID. Isso evita que clicar em "reimportar" gere outra rodada de duplicatas.

### 4. Reabilitar/aplicar dedup também em `send-whatsapp*` (saída manual do sistema)

As funções `send-whatsapp`, `send-whatsapp-audio`, `send-whatsapp-buttons`, `send-whatsapp-media` salvam a mensagem após enviar. Garantir que elas também passem pelo mesmo `upsert` por `whatsapp_msg_id` — assim o eco do webhook (`fromMe`) que chegar depois cai na dedup do índice único, sem precisar da janela frágil de 30s.

## Arquivos a alterar

- `supabase/migrations/<novo>.sql` — limpeza + índice único parcial
- `supabase/functions/whatsapp-chatbot/index.ts` — upsert por `whatsapp_msg_id` para entrada e fromMe (substitui dedup de 30s)
- `supabase/functions/import-recent-whatsapp-chats/index.ts` — upsert por `whatsapp_msg_id` + normalização de ID
- `supabase/functions/send-whatsapp/index.ts`, `send-whatsapp-audio/index.ts`, `send-whatsapp-buttons/index.ts`, `send-whatsapp-media/index.ts` — upsert por `whatsapp_msg_id` ao salvar a mensagem enviada

## O que NÃO muda

- Schema da tabela (só ganha um índice).
- Comportamento do Inbox no front (não precisa tocar no `WhatsAppInbox.tsx`).
- Lógica de leitura/não-leitura, etiquetas, mídias, áudio, etc.

## Resultado esperado

Mesmo se o UAZAPI mandar o mesmo evento 2x (ou 3x) em paralelo, o índice único impede a 2ª inserção no nível do banco — não há mais como aparecer mensagem duplicada no Inbox, nem do histórico, nem do tempo real, nem do envio próprio.