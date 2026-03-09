

# Plano: Admin comanda a IA também via WhatsApp

## Problema
Quando o admin envia mensagens pelo WhatsApp que não correspondem a um cliente pendente (`admin_pending`) e não casam com o regex de `parseAdminInstructionWithTarget`, a mensagem é simplesmente ignorada (linha 922). Exemplos que falham:
- "Volta na conversa com +556493097974 e passe a proposta" — "Volta" não está no regex
- Perguntas genéricas ou instruções de ensino

## Solução

**Arquivo**: `supabase/functions/whatsapp-chatbot/index.ts`

### 1. Expandir o regex de `parseAdminInstructionWithTarget`
Adicionar mais verbos e preposições para capturar padrões naturais:
- Verbos: `volta|retorne|responda|envie?|mande?|fale?|passe|vá|vai`
- Preposições: `numero|número|para|ao|com|do|da|de`
- Suporte a `+55` no número

### 2. Rota fallback: encaminhar para `teach-chatbot`
Quando a mensagem do admin não casa com nenhum padrão (nem pending, nem targeted), em vez de ignorar, invocar a edge function `teach-chatbot` com o contexto da conversa do admin. Isso permite:
- Ensinar regras via WhatsApp
- Fazer perguntas à IA
- Executar ações (a IA retorna `action: "send"` que já funciona no teach-chatbot)

O fluxo:
1. Admin envia mensagem genérica via WhatsApp
2. Sistema carrega histórico recente do admin do `chat_ia_mensagens`
3. Chama `teach-chatbot` com as mensagens
4. Se a resposta contiver `action: "send"` com confirmação pendente, responde pedindo confirmação
5. Se for texto normal, envia a resposta de volta ao admin via WhatsApp
6. Persiste as mensagens em `chat_ia_mensagens` (mesma tabela do chat web, com tag `teach-chatbot-whatsapp` para separar)

### 3. Fluxo resultante
```text
Admin (WhatsApp): "Volta na conversa com +556493097974 e passe a proposta"
         ↓
parseAdminInstructionWithTarget → match! telefone=556493097974
         ↓
(fluxo existente de proposta + confirmação)

--- OU ---

Admin (WhatsApp): "Me explica como funciona o desconto"
         ↓
Sem pending, sem target → fallback teach-chatbot
         ↓
IA responde → envio da resposta ao admin via WhatsApp
```

### 4. Compatibilidade
- Fluxo existente de `admin_pending` permanece prioritário
- `parseAdminInstructionWithTarget` expandido cobre mais padrões
- Fallback para `teach-chatbot` garante que nenhuma mensagem do admin é ignorada

