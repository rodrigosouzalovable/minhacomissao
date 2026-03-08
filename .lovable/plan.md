

# Transcrever áudios do WhatsApp no chatbot

## Problema
Quando o cliente envia um áudio no WhatsApp, o webhook recebe o payload mas o campo `texto` fica vazio (linha 398-404 do `whatsapp-chatbot/index.ts`), e a mensagem é ignorada (`if (!telefone || !texto) return`).

## Solução

Detectar mensagens de áudio no payload do webhook UAZAPI, baixar o áudio, transcrever usando o Lovable AI Gateway (Gemini), e usar o texto transcrito como se fosse uma mensagem de texto normal.

### Mudanças em `supabase/functions/whatsapp-chatbot/index.ts`

1. **Detectar áudio no payload**: O UAZAPI envia áudios com campos como `payload.message.audioMessage`, `payload.message.audio`, ou `payload.message.mediaUrl`. Verificar esses campos antes de descartar a mensagem por falta de texto.

2. **Criar função `transcreverAudio(audioUrl)`**:
   - Baixar o áudio da URL fornecida pelo UAZAPI (usando `payload.message.mediaUrl` ou similar)
   - Converter para base64
   - Enviar para o Lovable AI Gateway (mesmo modelo Gemini 2.5 Flash já usado no `transcribe-audio`)
   - Retornar o texto transcrito

3. **Alterar a lógica de extração de texto** (linhas ~398-404):
   - Se `texto` estiver vazio, verificar se há áudio no payload
   - Se houver áudio, chamar `transcreverAudio` e usar o resultado como `texto`
   - Se não houver nem texto nem áudio, aí sim ignorar

4. **Tratamento de erro**: Se a transcrição falhar, responder ao cliente com "Desculpe, não consegui ouvir seu áudio. Pode digitar sua resposta?"

### Detalhes técnicos da detecção UAZAPI
O payload de áudio do UAZAPI geralmente contém:
- `payload.message.audioMessage` (objeto com URL)
- `payload.message.mediaUrl` ou `payload.message.audio.url` (URL direta do arquivo)
- Será necessário testar os campos exatos; implementaremos verificação de múltiplos campos possíveis

## Arquivo alterado
- `supabase/functions/whatsapp-chatbot/index.ts`

