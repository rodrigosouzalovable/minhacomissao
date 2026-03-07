

# Acelerar execução de comandos do chat para o robô

## Problema identificado

O fluxo atual é lento porque cada comando do chat passa por **muitas camadas de latência encadeadas**:

1. **Chat → 1ª chamada IA** (~3-8s): Chamada non-streaming ao Gemini para decidir se usa tool call
2. **Chat → Edge Function `automacao-cobmais`** (~1-2s): Dispatch fire-and-forget, mas passa por outra Edge Function
3. **Edge Function → servidor local** (~1-2s): Chamada HTTP via ngrok
4. **Servidor local → Edge Function `analyze-cobmais-screen`** (~5-15s): Captura screenshot + envia imagem base64 + IA analisa
5. **Delays fixos no código**: `delay(2000)` após cada ação, `delay(300)` antes de clicks, `delay(2000)` após navigate

Para um login (3 ações: navigate + fill email + fill senha + click), são ~4 iterações × ~15s cada = **~60 segundos mínimo**. Isso explica a demora.

## Otimizações propostas

### 1. Reduzir delays fixos no `server.js`

| Ação | Delay atual | Delay proposto |
|------|-------------|----------------|
| `click` (pré) | 300ms | 200ms |
| `click` (pós) | 2000ms | 1000ms |
| `fill` | 500ms + delay de digitação (50ms/char) | 300ms + delay 20ms/char |
| `navigate` | 2000ms | 1000ms |
| `scroll` | 1000ms | 500ms |
| `keypress` | 2000ms | 1000ms |
| `wait` (AI error retry) | 2000ms / 3000ms | 1000ms / 1500ms |

### 2. Permitir múltiplas ações por iteração no chat

Atualmente `max_iterations: 1` no chat — a cada comando do chat, o robô faz **só 1 ação** e para. Para "acessar o link e fazer login", o usuário precisa dar ~4 comandos separados.

Mudança: quando o objetivo é claro e multi-passo (ex: "acesse o link X e faça login"), enviar `max_iterations: 5` ao invés de 1, permitindo que o agente complete o fluxo sem parar a cada ação.

Adicionar um parâmetro `max_iterations` na tool description para que a IA decida: ações simples = 1, fluxos complexos = 3-5.

### 3. Reduzir qualidade/tamanho do screenshot

Atualmente: JPEG quality 40. Mudar para quality 25 e reduzir resolução para diminuir o payload enviado à IA, acelerando upload e processamento.

### 4. Timeout do `analyze-cobmais-screen` 

Reduzir o `AbortSignal.timeout` de 30s para 20s e otimizar o prompt para ser mais conciso.

## Arquivos a modificar

| Arquivo | Mudança |
|---|---|
| `server.js` | Reduzir todos os delays, diminuir qualidade screenshot |
| `supabase/functions/chat-cobmais-knowledge/index.ts` | Permitir `max_iterations` variável (1-5) na tool, IA decide |

