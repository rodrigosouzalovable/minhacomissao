

# Execução quase instantânea: modo de comando direto

## Problema atual

Quando você dá um comando no chat, ele passa por **3 camadas de IA** antes de executar:
1. `chat-cobmais-knowledge` — IA decide chamar a tool (~3-5s)
2. `automacao-cobmais` → `server.js` — releia para o servidor local
3. `analyze-cobmais-screen` — **outra IA** analisa o screenshot e decide o que clicar (~3-5s)

Total: **6-12 segundos** antes de qualquer ação acontecer. A maior parte do tempo é gasta na chamada #3, que é redundante quando a IA do chat já sabe exatamente o que fazer (especialmente quando você envia um screenshot).

## Solução: Modo de Comando Direto

A IA do chat já recebe o screenshot e entende o que fazer. Em vez de passar um "objetivo em texto" para outro modelo de visão analisar novamente, ela pode enviar **ações estruturadas diretamente** ao servidor.

### Mudanças

#### 1. Nova tool no chat — `executar_acao_direta` (`chat-cobmais-knowledge/index.ts`)

Adicionar uma segunda tool que permite à IA enviar ações pré-definidas (click, fill, keypress, navigate) com seletor e valor, sem passar pela análise de visão.

```
Tool: executar_acao_direta
Params: action (click/fill/keypress/navigate/scroll), selector, value
```

#### 2. Novo endpoint no servidor — `/automacao/acao-direta` (`server.js`)

Endpoint que recebe a ação estruturada e executa imediatamente no Playwright, sem chamar a IA de visão. Mantém os mesmos delays reduzidos (200ms click, 300ms fill).

#### 3. Nova edge function relay — `automacao-cobmais/index.ts`

Adicionar suporte ao modo `"acao_direta"` que repassa a ação estruturada ao servidor local em vez de iniciar o loop do agente.

#### 4. Instruções no system prompt

Orientar a IA do chat a usar `executar_acao_direta` quando:
- O usuário envia screenshot + instrução clara ("clique neste botão")
- A IA já conhece o seletor CSS do elemento
- Ações simples e diretas (um clique, um preenchimento)

E usar `executar_automacao` (modo agente) apenas para fluxos complexos multi-passo.

### Resultado esperado

- **Antes**: 6-12s por ação (2 chamadas de IA)
- **Depois**: ~1-2s por ação (0 chamadas de IA extras, só execução direta no Playwright)

