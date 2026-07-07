## Objetivo

Quando o funcionário iniciar uma nova conversa pelo diálogo "Nova conversa Meta":
1. A mensagem no inbox aparece com o cabeçalho **"*Atendente {nome}:*"** antes do corpo do template (mesmo estilo das respostas dentro da janela de 24h).
2. O contato recém-criado recebe automaticamente a etiqueta **"Atendente: {nome}"** correspondente ao funcionário que iniciou a conversa (mesmo comportamento do rodízio, mas fixando no atendente que abriu).

Importante: o corpo do template enviado à Meta continua exatamente como aprovado (não podemos alterar o texto do template HSM). O prefixo "Atendente" é aplicado somente no **espelho local** da mensagem em `meta_whatsapp_mensagens.conteudo`, que é o que o inbox exibe.

## Alterações

### 1. `src/pages/InboxMeta.tsx`
- Passar a prop `atendenteNome` (já existente no state) para `<MetaNovaConversaDialog />`.

### 2. `src/components/inbox/meta/MetaNovaConversaDialog.tsx`
- Aceitar prop `atendenteNome?: string`.
- Repassar `atendente_nome` no body da chamada `supabase.functions.invoke('send-whatsapp-meta', …)`.

### 3. `supabase/functions/send-whatsapp-meta/index.ts`
- Ler `atendente_nome` do payload.
- No trecho que faz `insert` em `meta_whatsapp_mensagens`, prefixar `conteudo` com `*Atendente {atendente_nome}:*\n\n` (quando informado e ainda não presente).
- Após o `upsert` do contato (`meta_whatsapp_contatos`), se `atendente_nome` estiver presente:
  - Buscar em `meta_whatsapp_etiquetas` (filtrando por `user_id = inst.user_id`) a etiqueta com `nome ilike 'Atendente: {atendente_nome}'` (case-insensitive).
  - Se existir e o contato ainda não tiver essa etiqueta vinculada em `meta_whatsapp_contato_etiquetas`, inserir o vínculo (`contato_id`, `etiqueta_id`), tolerando duplicidade (código `23505`).
  - Se não existir etiqueta com esse nome, apenas logar e seguir (sem criar automaticamente, para não poluir a lista de etiquetas do admin).

## Fora de escopo
- Não altera o corpo real enviado à Meta (templates HSM são fixos).
- Não muda o rodízio automático das mensagens recebidas — a lógica atual continua funcionando para conversas iniciadas pelo cliente.
- Não cria novas etiquetas automaticamente: reutiliza somente as que o admin já cadastrou ("Atendente: X").
