

# Chat com a IA sobre o Conhecimento Aprendido

## O que será construído

Um chat integrado na seção "Conhecimento Aprendido" onde você conversa com a IA sobre o que ela aprendeu. A IA analisa todos os passos gravados nas sessões e responde suas perguntas. Se ela identificar lacunas ou dúvidas, sugere que você envie um novo vídeo explicando o ponto específico.

## Implementação

### 1. Nova Edge Function `chat-cobmais-knowledge`
- Recebe a mensagem do usuário + histórico do chat
- Busca todos os dados da tabela `cobmais_conhecimento` e `cobmais_sessoes_gravadas`
- Monta um system prompt instruindo a IA a: responder sobre o que aprendeu, listar dúvidas/lacunas, e sugerir envio de novo vídeo quando não souber algo
- Usa Gemini 3 Flash (streaming) para resposta rápida
- Retorna stream SSE

### 2. UI do Chat na seção Conhecimento (`AutomacaoCobMais.tsx`)
- Adicionar abaixo da tabela de sessões um card de chat com:
  - Área de mensagens (scroll) com markdown rendering
  - Input + botão enviar
  - Streaming token-by-token da resposta
- Quando a IA sugerir enviar vídeo, um botão inline abre o dialog de upload de vídeo
- Estado: `chatMessages`, `chatInput`, `isChatLoading`

### 3. System Prompt da IA
O prompt instrui a IA a:
- Analisar todos os fluxos gravados e seus passos
- Responder em português sobre o que sabe fazer
- Identificar passos vagos ou incompletos e pedir esclarecimento
- Sugerir explicitamente "envie um novo vídeo explicando [X]" quando houver lacuna

## Arquivos

| Arquivo | Mudança |
|---|---|
| `supabase/functions/chat-cobmais-knowledge/index.ts` | Nova edge function com streaming |
| `supabase/config.toml` | Registrar a nova function |
| `src/pages/AutomacaoCobMais.tsx` | Chat UI na seção Conhecimento |

