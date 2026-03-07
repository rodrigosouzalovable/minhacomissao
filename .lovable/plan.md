

# Botão de Interromper Automação no Chat

## O que será feito

Adicionar um botão "Parar" (ícone ■) que aparece durante a execução do chat/automação, permitindo cancelar a operação em andamento. Ao clicar, o streaming SSE é abortado e uma mensagem indica que foi interrompido.

## Mudanças

| Arquivo | Mudança |
|---|---|
| `src/pages/AutomacaoCobMais.tsx` | Adicionar `AbortController` ref, botão de parar ao lado do input durante loading, e lógica de abort |

### Detalhes técnicos

1. Criar `chatAbortRef = useRef<AbortController | null>(null)` 
2. No `handleChatSend`, criar um `AbortController`, armazenar em `chatAbortRef`, e passar `signal` no fetch
3. Criar `handleChatStop` que chama `chatAbortRef.current?.abort()` e limpa o estado de loading
4. No input area, quando `isChatLoading` for true, trocar o botão Send por um botão vermelho com ícone `Square` (parar) que chama `handleChatStop`
5. No catch, detectar `AbortError` e adicionar mensagem "⏹️ Comando interrompido pelo usuário" em vez de mostrar toast de erro

