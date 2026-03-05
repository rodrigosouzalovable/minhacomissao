

## Diagnóstico

O webhook ESTÁ chegando da UAZAPI (confirmado nos logs), mas a Edge Function não consegue extrair o telefone e o texto da mensagem porque o **formato do payload da UAZAPI é diferente** do que o código espera.

**Payload recebido** (visível nos logs):
```json
{
  "BaseUrl": "https://certificadoracnpj.uazapi.com",
  "EventType": "messages",
  "chat": { "id": "ra51f0e4f6ed00d", ... },
  ...
}
```

**O que o código espera:**
```
message.key.remoteJid → telefone
message.message.conversation → texto
message.fromMe → ignorar mensagens do bot
```

A UAZAPI envia os dados em campos como `from`, `body`, `fromMe`, `isGroup` etc. diretamente no payload ou dentro de um objeto diferente. Como o código não encontra `telefone` nem `texto`, ele retorna `{ ignored: true, reason: 'no phone or text' }` silenciosamente.

## Plano de Correção

### 1. Aumentar log do payload para debug
Logar o payload completo (sem truncar a 500 chars) para ver a estrutura exata.

### 2. Atualizar parsing do webhook na Edge Function `whatsapp-chatbot`
Adaptar a extração de dados para o formato real da UAZAPI, que tipicamente envia:
- `payload.from` ou `payload.chat.id` → número do telefone
- `payload.body` ou `payload.text` → texto da mensagem  
- `payload.fromMe` → se foi enviado pelo bot
- `payload.isGroup` → se é grupo
- `payload.key.remoteJid` → alternativa para o número

O código será atualizado para tentar múltiplos caminhos de extração para cobrir diferentes versões do payload UAZAPI:

```typescript
// Extrair telefone - tentar múltiplos caminhos
const remoteJid = payload?.key?.remoteJid 
  || payload?.from 
  || payload?.chat?.id 
  || payload?.message?.key?.remoteJid 
  || '';

// Extrair texto - tentar múltiplos caminhos  
const texto = (payload?.body 
  || payload?.text 
  || payload?.message?.body
  || payload?.message?.conversation 
  || payload?.message?.extendedTextMessage?.text 
  || payload?.message?.message?.conversation
  || '').trim();

// Verificar fromMe e isGroup
const isFromMe = payload?.fromMe ?? payload?.key?.fromMe ?? false;
const isGroup = payload?.isGroup ?? remoteJid.includes('@g.us') ?? false;
```

### 3. Logar dados extraídos para debugging
Após a extração, logar os valores para confirmar que estão corretos antes de processar.

### Arquivo a modificar
- `supabase/functions/whatsapp-chatbot/index.ts` — atualizar parsing do payload

