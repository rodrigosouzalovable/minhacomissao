## Objetivo

No WhatsApp Inbox, sempre que o usuário abrir uma conversa, o campo de digitação (`Textarea` em `ChatInputBar.tsx`) deve receber foco automaticamente, permitindo digitar imediatamente sem precisar clicar.

## Arquivo afetado

- `src/components/inbox/ChatInputBar.tsx`

## Mudanças

1. Adicionar um `useEffect` que dá `.focus()` no `textareaRef.current` quando:
   - A conversa muda — disparado por mudança em `telefone` e/ou `instanciaId` (props que identificam unicamente a conversa aberta).
   - O componente sai do estado desabilitado/gravando (ex.: termina de enviar, cancela gravação).
2. Garantir que o foco só ocorra quando o textarea está habilitado (não disparar enquanto `isLoading`, `gravando` ou `transcrevendo`).
3. Pequeno `setTimeout(..., 0)` ou `requestAnimationFrame` para garantir foco após a renderização (caso o textarea acabou de voltar do modo de gravação).

## Comportamento resultante

- Abriu conversa do cliente A → cursor já piscando no campo, pronto pra digitar.
- Trocou pra conversa do cliente B → foco move pro campo da nova conversa.
- Saiu do modo de gravação de áudio → foco volta pro campo.

## Fora do escopo

- Não mexer em layout, atalhos, gravação, anexos, respondendo ou quick replies.
- Não alterar `WhatsAppInbox.tsx`.