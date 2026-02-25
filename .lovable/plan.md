

# Correção do botão "Testar Conexão" UAZAPI

## Problema identificado

O teste de conexão está falhando porque a requisição é feita **diretamente do navegador** para o servidor UAZAPI. Servidores externos como UAZAPI não permitem requisições cross-origin (CORS) vindas de navegadores. O envio de mensagens funciona porque passa por uma backend function, mas o teste de conexão tenta chamar a UAZAPI diretamente do frontend.

## Solução

Criar uma backend function `test-uazapi-connection` que faz a requisição ao servidor UAZAPI no lado do servidor (sem restrição de CORS), e alterar o frontend para chamar essa function em vez de acessar a UAZAPI diretamente.

### 1. Criar `supabase/functions/test-uazapi-connection/index.ts`

- Recebe `server_url` e `instance_token` no body da requisição
- Faz GET para `${server_url}/status/${instance_token}`
- Retorna o resultado (status connected/disconnected) ou erro

### 2. Alterar `src/pages/Acionamento.tsx`

- Na função `handleTestUazapiConnection`, substituir o `fetch` direto por uma chamada à backend function via `supabase.functions.invoke('test-uazapi-connection', { body: { server_url, instance_token } })`
- Exibir toast de sucesso com o status retornado, ou toast de erro

### 3. Registrar a function em `supabase/config.toml`

- Adicionar entrada `[functions.test-uazapi-connection]` com `verify_jwt = false`

### Resumo das mudanças
- **1 arquivo novo**: `supabase/functions/test-uazapi-connection/index.ts`
- **1 arquivo editado**: `src/pages/Acionamento.tsx` (função de teste)

