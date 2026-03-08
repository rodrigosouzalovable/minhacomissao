

# Fix: Chatbot enviando múltiplas mensagens

## Problema identificado

Analisando o código, há **dois problemas** causando a enxurrada de mensagens:

### 1. Envio duplicado (double send)
Nos casos `avista` (linha 756) e `parcelado` (linha 873), o código chama `sendMessage()` diretamente dentro do branch. Porém, no final da função (linhas 948-954), há um bloco genérico que envia `resposta` novamente para **todos** os casos. Resultado: cada mensagem é enviada 2x ou mais.

### 2. Sem deduplicação de webhooks
O WhatsApp/UAZAPI pode disparar o webhook múltiplas vezes para a mesma mensagem. Sem controle de dedup, cada disparo gera uma resposta completa.

## Solução

### A. Flag `jaEnviou` para evitar double send
Adicionar uma variável `let jaEnviou = false` no início do fluxo. Nos branches que já chamam `sendMessage` internamente (`avista`, `parcelado`), setar `jaEnviou = true`. No bloco final (linha 948), só enviar se `!jaEnviou`.

### B. Deduplicação por message ID
Extrair um ID único da mensagem do webhook (ex: `payload.message?.id` ou `payload.key?.id`). Antes de processar, verificar se esse ID já foi processado recentemente (salvar na tabela `chatbot_conversas.dados` ou checar com uma query rápida). Se já foi, ignorar.

### C. Injetar regras ensinadas no system prompt
Para que a IA use o conhecimento ensinado em TODAS as respostas (não só match exato), injetar as regras ativas como contexto adicional no `SYSTEM_PROMPT` passado para `gerarRespostaHumana`.

## Arquivos alterados
- `supabase/functions/whatsapp-chatbot/index.ts` — flag `jaEnviou`, dedup de mensagens, injeção de regras no prompt

