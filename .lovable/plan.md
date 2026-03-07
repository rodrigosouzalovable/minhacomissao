

# Tornar a execução de automação assíncrona no chat

## Problema
Quando o usuário dá um comando no chat, a edge function `chat-cobmais-knowledge` chama `automacao-cobmais` com `agent_execute` e **espera o resultado completo** (até 6 minutos de timeout). O agente roda 30 iterações de análise de tela, cada uma demorando vários segundos. A resposta do chat só aparece depois que toda a automação termina.

## Solução
Tornar a chamada de automação **assíncrona (fire-and-forget)**. O chat dispara a automação sem esperar o resultado e responde imediatamente ao usuário, que pode acompanhar em tempo real pelo Streaming do Robô que já existe na tela.

## Mudanças

| Arquivo | O que muda |
|---|---|
| `supabase/functions/chat-cobmais-knowledge/index.ts` | Dispara automação sem `await`, retorna imediatamente para a 2a chamada da IA |

### Detalhes

1. **Fire-and-forget**: Ao detectar tool call, disparar o `fetch` para `automacao-cobmais` **sem await** (apenas iniciar a promise, sem esperar)
2. **Tool result imediato**: Em vez de esperar o resultado real, retornar uma mensagem como: `"Automação iniciada com sucesso! O robô está executando o objetivo: [X]. O usuário pode acompanhar em tempo real na seção 'Streaming do Robô' acima."`
3. **System prompt**: Adicionar instrução para a IA informar que a automação foi disparada e que o usuário deve acompanhar pelo streaming, e que pode perguntar no chat depois se teve algum problema
4. Isso faz o chat responder em ~5-8 segundos (2 chamadas rápidas à IA) em vez de minutos

### Fluxo novo
```text
Usuário digita comando
       ↓
1a chamada IA (2-3s) → detecta tool call
       ↓
Dispara automação (fire-and-forget, sem esperar)
       ↓
2a chamada IA (2-3s) → streama "Automação iniciada! Acompanhe pelo streaming..."
       ↓
Total: ~5-8 segundos
       ↓
Robô executa em background (usuário vê no streaming)
```

