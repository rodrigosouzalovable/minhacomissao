

## Plan: Send CobMais credentials from Edge Function to local server

### Problem
The `automacao-cobmais` Edge Function fetches `server_url` from `automacao_config` but does NOT include `cobmais_email` and `cobmais_senha` when calling the local Playwright server.

### Change
**File: `supabase/functions/automacao-cobmais/index.ts`**

In the `execute` case (around line 120), change the config query from:
```typescript
.select('server_url')
```
to:
```typescript
.select('server_url, cobmais_email, cobmais_senha')
```

Then update the fetch body to include the credentials:
```typescript
body: JSON.stringify({
  acao,
  parametros: parametros || {},
  cobmais_email: config.cobmais_email,
  cobmais_senha: config.cobmais_senha
})
```

This way the local `server.js` receives the credentials dynamically from the database and can use them to log into CobMais without hardcoding anything locally.

