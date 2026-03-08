

## Diagnóstico

Os logs confirmam que o **parsing está funcionando corretamente** agora. O chatbot extraiu o telefone `556282184790` e o texto `"Olá"` com sucesso. O problema é na **resposta**: o erro é `"WhatsApp disconnected"`.

**Causa raiz**: O chatbot usa as credenciais globais (secret `UAZAPI_INSTANCE_TOKEN = e4438332-...`) para enviar a resposta. Essas credenciais são de uma instância **diferente** da que recebeu a mensagem (62991672674 / "IPHONE RODRIGO 2674").

O payload do webhook contém os dados da instância correta:
- `payload.BaseUrl` = `"https://certificadoracnpj.uazapi.com"`  
- `payload.token` = `"3085f4de-ac57-4b90-b7a3-6c12fa4348b2"`

A instância global (token `e4438332-...`) está com WhatsApp desconectado, por isso todas as tentativas de envio falham.

## Correção

Modificar o `whatsapp-chatbot/index.ts` para usar o **token e URL que vêm no próprio webhook** ao invés das credenciais globais. Assim, a resposta é enviada pela mesma instância que recebeu a mensagem.

```typescript
// ANTES: usa credenciais globais fixas
const serverUrl = Deno.env.get('UAZAPI_SERVER_URL');
const instanceToken = Deno.env.get('UAZAPI_INSTANCE_TOKEN');

// DEPOIS: prioriza credenciais do payload, fallback para globais
const serverUrl = payload?.BaseUrl || Deno.env.get('UAZAPI_SERVER_URL');
const instanceToken = payload?.token || Deno.env.get('UAZAPI_INSTANCE_TOKEN');
```

### Arquivo a modificar
- `supabase/functions/whatsapp-chatbot/index.ts` — usar `payload.BaseUrl` e `payload.token` para enviar a resposta pela instância correta

