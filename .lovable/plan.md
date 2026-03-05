

## Correção do Parsing do Webhook UAZAPI

### Problema
O payload da UAZAPI tem uma estrutura específica diferente do esperado. Os dados estão em:
- **Telefone**: `payload.message.chatid` (ex: `"556282184790@s.whatsapp.net"`) ou `payload.chat.wa_chatid`
- **Texto**: `payload.message.text` (ex: `"Olá"`)
- **fromMe**: `payload.message.fromMe`
- **isGroup**: `payload.message.isGroup` ou `payload.chat.wa_isGroup`

O código atual tenta `payload.chat.id` que retorna um ID interno (`r3794054a18cbb7`) e não encontra o texto porque não verifica `payload.message.text`.

### Correção

Atualizar `supabase/functions/whatsapp-chatbot/index.ts` - reordenar a prioridade de extração:

```typescript
// Telefone - priorizar campos corretos da UAZAPI
const remoteJid = payload?.message?.chatid
  || payload?.chat?.wa_chatid
  || payload?.message?.sender_pn
  || payload?.key?.remoteJid
  || payload?.from
  || '';

// Texto - priorizar payload.message.text
const texto = (payload?.message?.text
  || payload?.body
  || payload?.text
  || payload?.message?.body
  || payload?.message?.conversation
  || payload?.message?.content?.text
  || '').trim();

// fromMe e isGroup
const isFromMe = payload?.message?.fromMe ?? payload?.fromMe ?? false;
const isGroup = payload?.message?.isGroup ?? payload?.chat?.wa_isGroup ?? false;
```

### Arquivo a modificar
- `supabase/functions/whatsapp-chatbot/index.ts`

