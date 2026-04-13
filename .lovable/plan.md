

## Salvar contatos automaticamente na agenda do dispositivo

### Contexto
Atualmente, o salvamento de contatos só acontece no fluxo de aquecimento (`whatsapp-ia-responder`). O usuário quer que **toda conversa recebida** — de qualquer número — salve automaticamente o contato na agenda física do WhatsApp do dispositivo.

### Como funciona
O webhook `whatsapp-chatbot` já recebe o nome do perfil do contato via `pushName`/`senderName` (linha 849). Basta adicionar a lógica de salvamento de contato nessa função, usando o mesmo padrão `salvarContatoUAZAPI` que já existe no `whatsapp-ia-responder`.

### Implementação

#### 1. Adicionar `salvarContatoUAZAPI` no `whatsapp-chatbot/index.ts`
- Copiar a função `salvarContatoUAZAPI` (endpoints `/contact/add`, `/contact/upsert`, etc.)
- Executar logo após detectar o telefone e nome do contato (após linha 849)
- Só salvar se:
  - `isFromMe === false` (mensagem recebida, não enviada)
  - `inboxNomeContato` existe (tem nome de perfil)
  - `inboxServerUrl` e `inboxInstanceToken` existem
- Executar de forma **fire-and-forget** (não bloquear o processamento do webhook)
- Adicionar cache simples: verificar na tabela `whatsapp_inbox_conversas` se o contato já tem `nome_contato` salvo — se já tem, pular (evitar chamadas repetidas a cada mensagem)

#### 2. Controle de duplicatas (evitar salvar a cada mensagem)
- Usar a coluna `nome_contato` da tabela `whatsapp_inbox_conversas` como indicador
- Se já existe conversa com `nome_contato` preenchido para aquele telefone, não tenta salvar novamente
- Só tenta salvar na **primeira mensagem** de um contato novo ou quando o nome muda

### Arquivos
1. **`supabase/functions/whatsapp-chatbot/index.ts`** — adicionar função `salvarContatoUAZAPI` + chamada fire-and-forget no fluxo de webhook
2. **Deploy** da edge function

### Resultado
Todo contato que enviar mensagem terá seu nome de perfil do WhatsApp salvo automaticamente na agenda física do dispositivo, sem impacto no desempenho do webhook.

