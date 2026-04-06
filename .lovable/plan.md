

## Plano: Importar histórico de mensagens antigas do WhatsApp

### O que será feito

Ao abrir uma conversa no Inbox que ainda não tenha mensagens no banco (ou que tenha poucas), o sistema buscará automaticamente o histórico de mensagens antigas diretamente da API da UAZAPI e salvará no banco para exibição.

### Como funciona

A UAZAPI possui o endpoint `POST /chat/getMessages` que retorna mensagens anteriores de um chat. O sistema chamará esse endpoint para importar mensagens antigas quando o usuário abrir uma conversa.

### Implementação

**1. Nova Edge Function: `fetch-whatsapp-history`**

- Recebe: `server_url`, `instance_token`, `instancia_id`, `telefone`
- Chama `POST {server_url}/chat/getMessages` com o número formatado (`telefone@s.whatsapp.net`) e `count: 50`
- Para cada mensagem retornada, faz upsert na tabela `whatsapp_mensagens` (evitando duplicatas via verificação de timestamp + conteúdo + direção)
- Também cria/atualiza o registro em `whatsapp_contatos` se necessário
- Retorna o número de mensagens importadas

**2. Atualizar `WhatsAppInbox.tsx`**

- Ao selecionar um contato, após carregar as mensagens do banco, se houver poucas mensagens (ex: < 5), dispara automaticamente a chamada à edge function `fetch-whatsapp-history`
- Adiciona um botão "Carregar histórico" no topo do chat para importação manual
- Exibe um indicador de carregamento durante a importação
- Após a importação, recarrega as mensagens do banco

**3. Botão manual no cabeçalho do chat**

- Ícone de "download/histórico" ao lado do nome do contato
- Ao clicar, chama a edge function e importa mensagens antigas
- Toast de sucesso com quantidade de mensagens importadas

### Detalhes técnicos

- O endpoint da UAZAPI para histórico: `POST /chat/getMessages` com body `{ id: "5511999999999@s.whatsapp.net", count: 50 }`
- Deduplicação: antes de inserir, verifica se já existe mensagem com mesmo `instancia_id`, `telefone_remoto`, `timestamp_msg` e `conteudo`
- Mensagens do histórico terão `direcao` definida pelo campo `fromMe` do payload
- O conteúdo é extraído do campo `message.conversation` ou `message.extendedTextMessage.text`
- Limite de 50 mensagens por requisição para não sobrecarregar
- Sem necessidade de migration SQL (usa tabelas existentes)

### Arquivos afetados
- Nova: `supabase/functions/fetch-whatsapp-history/index.ts`
- Editado: `src/pages/WhatsAppInbox.tsx`

