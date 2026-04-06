

## Plano: Nova conversa, fixar conversas e proteção contra exclusão

### 1. Botão "+" para nova conversa

Adicionar um ícone "+" ao lado do título "WhatsApp Inbox" (linha 454) que abre um Dialog com:
- Campo de telefone (com código do país, placeholder "55...")
- Select para escolher a instância
- Campo de texto para a primeira mensagem
- Botão "Conversa" que envia a mensagem via `send-whatsapp` e abre/cria o contato no inbox

**Arquivo:** `src/pages/WhatsAppInbox.tsx` — novo state `novaConversaOpen`, novo componente Dialog inline ou extraído.

### 2. Fixar conversa (pin)

**Migração:** Adicionar coluna `fixado boolean default false` na tabela `whatsapp_contatos`.

**Context menu:** Adicionar opção "Fixar conversa" / "Desafixar conversa" no `ConversaContextMenu.tsx` com ícone `Pin`. Ao clicar, faz update em `whatsapp_contatos.fixado`.

**Ordenação:** No `contatosFiltrados` (linha 405-415), alterar o sort para priorizar `fixado = true` antes de `nao_lido`, exatamente como o WhatsApp Web. Conversas fixadas mostrarão um ícone de pin pequeno na lista.

**Props:** Passar `fixado` e callback `onFixarToggle` para o `ConversaContextMenu`.

### 3. Proteção contra exclusão de mensagens

As mensagens já são persistidas no banco via webhook. O requisito "não sumir do sistema mesmo que apaguem no WhatsApp" já está atendido — o webhook salva e não há lógica de DELETE sincronizado. Nenhuma alteração necessária aqui, pois a UAZAPI não envia evento de exclusão que o sistema processe.

### Arquivos afetados

- `src/pages/WhatsAppInbox.tsx` — botão +, dialog nova conversa, ordenação com fixado
- `src/components/inbox/ConversaContextMenu.tsx` — opção fixar/desafixar
- Migração SQL — coluna `fixado` em `whatsapp_contatos`

### Detalhes técnicos

**Ordenação final dos contatos:**
```text
1. fixado DESC (fixados primeiro)
2. nao_lido > 0 (não lidos depois)
3. ultima_mensagem_em DESC (mais recentes)
```

**Dialog nova conversa:** Ao enviar, o sistema chama `send-whatsapp` com a instância selecionada. Se o contato já existir no banco, abre a conversa. Se não, o webhook criará o contato automaticamente e a lista será atualizada via realtime.

