

## Problema

O relatório diário está sendo enviado pelo número **6282183144** (instância global UAZAPI nos secrets do ambiente), em vez de usar as credenciais UAZAPI que você cadastrou no seu perfil via "Configurar UAZAPI".

A função `daily-report-whatsapp` busca credenciais da tabela `profiles` com `whatsapp_lembrete_server_url` e `whatsapp_lembrete_instance_token`, mas a query genérica (`limit(1)`) pode estar pegando o perfil errado, ou as credenciais do seu perfil podem não estar sendo encontradas.

Além disso, o frontend não passa o `user_id` do usuário logado para a Edge Function, então ela não sabe qual perfil usar.

## Solução

### 1. Frontend - Passar o user_id do usuário logado

Em `src/pages/EquipeAcordos.tsx`, alterar a chamada para enviar o `user_id` do usuário autenticado:

```typescript
const { data: { user } } = await supabase.auth.getUser();
const { data, error } = await supabase.functions.invoke('daily-report-whatsapp', {
  body: { user_id: user?.id }
});
```

### 2. Edge Function - Buscar credenciais do perfil específico

Em `supabase/functions/daily-report-whatsapp/index.ts`, alterar para:

1. Ler o `user_id` do body da requisição
2. Buscar as credenciais UAZAPI **desse perfil específico** primeiro
3. Fallback para qualquer perfil com credenciais configuradas
4. Último fallback para variáveis de ambiente globais

```typescript
const { user_id } = await req.json().catch(() => ({}));

// Primeiro: buscar do perfil do usuário que clicou
let serverUrl, instanceToken;
if (user_id) {
  const { data: userProfile } = await supabase
    .from('profiles')
    .select('whatsapp_lembrete_server_url, whatsapp_lembrete_instance_token')
    .eq('id', user_id)
    .single();
  serverUrl = userProfile?.whatsapp_lembrete_server_url;
  instanceToken = userProfile?.whatsapp_lembrete_instance_token;
}

// Fallback: qualquer perfil com credenciais
if (!serverUrl || !instanceToken) {
  // ... busca genérica existente
}

// Último fallback: env vars
serverUrl = serverUrl || Deno.env.get('UAZAPI_SERVER_URL');
instanceToken = instanceToken || Deno.env.get('UAZAPI_INSTANCE_TOKEN');
```

### 3. Mesma lógica para `notify-cpf-consulta`

Atualizar também a função `notify-cpf-consulta` para buscar credenciais do perfil correto (o admin com número 62991672674).

Neste caso, como não há um usuário logado disparando, buscar especificamente pelo perfil que tem o telefone cadastrado ou manter a busca genérica na tabela `profiles`.

