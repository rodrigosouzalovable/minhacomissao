

# Chat com IA executando comandos de automação

## Problema
O chat "Conversar com a IA sobre o Conhecimento" apenas descreve os passos que aprendeu, mas não dispara a automação no robô. Quando você pede para emitir um boleto, a IA responde textualmente mas não executa nada.

## Solução
Transformar o chat em um agente que pode decidir executar ações. A IA usará **tool calling** para disparar comandos de automação quando o usuário pedir para executar algo (em vez de apenas descrever).

## Mudanças

### 1. Edge Function `chat-cobmais-knowledge/index.ts`
- Adicionar uma tool `executar_automacao` com parâmetros `objetivo` (string) ao modelo
- Quando a IA chamar essa tool, a edge function internamente invoca a `automacao-cobmais` com `action: 'agent_execute'` usando o service role
- Retorna o resultado da execução como resposta da tool e continua o streaming com a resposta final da IA
- Como tool calling não funciona com streaming, a chamada será feita em modo não-streaming: primeiro chama a IA para decidir se executa ou não, se sim executa o agente, depois retorna a resposta final via streaming

### 2. Frontend `src/pages/AutomacaoCobMais.tsx`  
- No `handleChatSend`, após a resposta da IA, não precisa de mudanças grandes — o chat já renderiza markdown
- Adicionar uma mensagem de status enquanto a automação estiver rodando (ex: "⚙️ Executando automação...")

## Fluxo técnico

```text
Usuário digita comando no chat
        ↓
Edge Function recebe mensagem
        ↓
Chama IA COM tool "executar_automacao"
        ↓
IA decide: é um pedido de execução?
  ├─ NÃO → responde normalmente (streaming)
  └─ SIM → chama tool executar_automacao(objetivo)
              ↓
        Edge Function invoca automacao-cobmais
        internamente (agent_execute)
              ↓
        Retorna resultado para a IA
              ↓
        IA responde com resultado (streaming)
```

### Detalhes da implementação

**Edge Function `chat-cobmais-knowledge`:**
- 1a chamada: não-streaming, com tool `executar_automacao` definida
- Se a IA retornar tool_call:
  - Extrair `objetivo` dos argumentos
  - Chamar `automacao-cobmais` internamente via fetch (com SUPABASE_SERVICE_ROLE_KEY e userId do token)
  - Montar mensagem de resultado da tool
  - 2a chamada: streaming, com histórico + resultado da tool → retorna stream
- Se não retornar tool_call:
  - 2a chamada: streaming normal com as mensagens → retorna stream

**Frontend `AutomacaoCobMais.tsx`:**
- Quando a resposta demora (automação rodando), o loading spinner já existe
- Adicionar toast "Automação em execução..." quando detectar que está demorando mais de 5s

