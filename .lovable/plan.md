

# Correção do teste de conexão UAZAPI

## Problema identificado

Testei diretamente a edge function e confirmei: a UAZAPI retorna **404 Not Found**. O endpoint `/status/${instance_token}` não existe na API v2 da UAZAPI.

De acordo com a documentação oficial da UAZAPI v2:
- A autenticação é feita via **header `token`**, não na URL
- O endpoint de status da instância usa um caminho diferente

O `send-whatsapp` funciona porque usa `/sendText/${instance_token}` (formato antigo que o servidor ainda aceita), mas `/status/${token}` não existe.

## Solução

Alterar a edge function `test-uazapi-connection` para usar o formato correto da API UAZAPI v2:

### Alteração em `supabase/functions/test-uazapi-connection/index.ts`

Mudar de:
```
GET ${server_url}/status/${instance_token}
```

Para tentar múltiplos formatos, priorizando o v2:
```
GET ${server_url}/instance/status
Header: token = ${instance_token}
```

Com fallback para o formato alternativo:
```
GET ${server_url}/status
Header: token = ${instance_token}
```

A edge function tentará o endpoint com autenticação via header e retornará o resultado. Também melhorar a mensagem de erro no frontend para exibir detalhes da resposta da UAZAPI.

### Alteração em `src/pages/Acionamento.tsx`

Melhorar a mensagem de erro para incluir detalhes retornados pela UAZAPI, facilitando o diagnóstico.

### Resumo
- **1 arquivo editado**: `supabase/functions/test-uazapi-connection/index.ts` (corrigir endpoint e autenticação)
- **1 arquivo editado**: `src/pages/Acionamento.tsx` (melhorar mensagem de erro)

