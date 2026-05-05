## Problema

No `WhatsApp Inbox`, não é possível selecionar o texto das mensagens com o mouse. Só funciona o menu de contexto (botão direito → copiar).

A causa está em `src/components/inbox/ChatMessage.tsx`:

1. O wrapper externo do balão tem a classe `select-none` (CSS `user-select: none`), que impede a seleção de texto em todos os filhos.
2. Os handlers de swipe-to-reply (`onPointerDown/Move/Up`) capturam o gesto do mouse antes que o navegador consiga iniciar uma seleção de texto, então arrastar dentro do balão move o balão em vez de selecionar.

## Mudanças

Arquivo único: `src/components/inbox/ChatMessage.tsx`

### 1) Remover `select-none` do wrapper, manter apenas onde precisa

- Remover `select-none` do `<div ref={swipeRef} ...>` externo.
- Aplicar `select-text` (ou simplesmente não bloquear) na `<div>` interna do balão (a que renderiza `renderQuoted()` + `renderContent()`), garantindo que parágrafos de texto fiquem selecionáveis.
- O ícone de swipe (CornerUpLeft) e o rodapé com horário/checks continuam com `select-none` para não atrapalhar o highlight.

### 2) Swipe-to-reply só pelas bordas / em telas touch

Para não conflitar com a seleção de texto via mouse, ajustar `handlePointerDown`:

- Se `e.pointerType === 'mouse'`: **não iniciar swipe** quando o clique cair sobre conteúdo de texto/imagem do balão. O swipe só inicia em mouse via duplo clique (que já dispara `triggerReply`) ou pelo menu de contexto → "Responder". Em mouse, o `onPointerDown` simplesmente não arma `swipeState.active`.
- Se `e.pointerType === 'touch'` ou `'pen'`: comportamento atual mantido (swipe lateral funciona normalmente em mobile).

Isso preserva o gesto de responder no celular (que é onde o swipe é útil) e libera a seleção natural com mouse no desktop.

### 3) Pequenos ajustes

- O elemento `<p className="whitespace-pre-wrap break-words">{msg.conteudo}</p>` em `renderContent()` recebe `select-text cursor-text` para deixar claro ao usuário que o texto é selecionável.
- O `ContextMenuTrigger` continua funcionando: o menu de contexto do Radix abre tanto em clique-direito sobre texto selecionado quanto em texto não selecionado.

## Fora de escopo

- Não mexer em outros componentes de chat (ex.: `ChatHistoryDialog`).
- Não alterar o comportamento de swipe em mobile.
- Sem mudanças de banco de dados, edge functions ou custo de Cloud.