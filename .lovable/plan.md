

# Correção do envio de mensagens via UAZAPI

## Problema identificado

Os logs da edge function `send-whatsapp` mostram claramente o erro:

```
Resposta da UAZAPI: { code: 405, message: "Method Not Allowed.", data: {} }
```

A URL usada é `${server_url}/sendText/${instance_token}` -- o token está na URL. Porém, a UAZAPI v2 exige autenticação via **header `token`**, não na URL. O endpoint `test-uazapi-connection` já foi corrigido para usar o header e funciona. Agora o `send-whatsapp` precisa da mesma correção.

## Solução

### Alteração em `supabase/functions/send-whatsapp/index.ts`

Mudar o bloco UAZAPI de:
```typescript
const uazapiUrl = `${uazapi_server_url}/sendText/${uazapi_instance_token}`;
fetch(uazapiUrl, {
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone, message })
});
```

Para:
```typescript
const cleanUrl = uazapi_server_url.replace(/\/+$/, '');
const uazapiUrl = `${cleanUrl}/sendText`;
fetch(uazapiUrl, {
  headers: { 
    'Content-Type': 'application/json',
    'token': uazapi_instance_token 
  },
  body: JSON.stringify({ phone, message })
});
```

A mudança é: remover o token da URL e passá-lo como header `token`, consistente com o formato v2 da UAZAPI que já funciona no teste de conexão.

### Resumo
- **1 arquivo editado**: `supabase/functions/send-whatsapp/index.ts` (corrigir autenticação UAZAPI)

