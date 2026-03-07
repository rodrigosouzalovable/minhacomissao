

## Correção: Edge Function `agent_execute` recebe HTML do servidor local

### Diagnóstico

A Edge Function `automacao-cobmais` (caso `agent_execute`) chama `${config.server_url}/automacao/agent` no seu servidor local. O servidor responde com **HTML** em vez de JSON (provavelmente uma página 404 do Express ou do ngrok), e `await res.json()` falha com "Unexpected token '<'".

As chamadas de `/status` funcionam normalmente (retornam JSON), mas o endpoint `/automacao/agent` provavelmente **não existe ainda no seu servidor local** — você precisa copiar o `server.js` atualizado (que contém o endpoint `/automacao/agent`) e reiniciar o servidor.

### Alteração no código

**`supabase/functions/automacao-cobmais/index.ts`** — No caso `agent_execute`, antes de fazer `res.json()`:
- Verificar se `res.ok` é false
- Verificar se o `Content-Type` da resposta é HTML
- Se for HTML, retornar erro claro: "Servidor local retornou HTML — verifique se o server.js está atualizado com o endpoint /automacao/agent"
- Envolver `res.json()` em try-catch adicional para mensagem amigável

Isso evita o erro genérico de JSON parse e orienta o usuário sobre o problema real.

