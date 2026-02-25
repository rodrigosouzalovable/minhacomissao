

# Configuração UAZAPI por Funcionário no Acionamento

## Resumo
Adicionar uma aba "Configuração" na página de Acionamento onde cada funcionário pode configurar suas credenciais da UAZAPI (Server URL e Instance Token). O admin continua usando a Z-API existente. O sistema detecta automaticamente qual API usar ao enviar mensagens.

## Alterações

### 1. Nova tabela no banco de dados: `user_whatsapp_config`

```sql
CREATE TABLE public.user_whatsapp_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  provider TEXT NOT NULL DEFAULT 'uazapi',
  server_url TEXT NOT NULL,
  instance_token TEXT NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT now(),
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_whatsapp_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own config"
  ON public.user_whatsapp_config
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### 2. Atualizar Edge Function `send-whatsapp`

Aceitar parâmetros opcionais `uazapi_server_url` e `uazapi_instance_token` no body da requisição. Se presentes, usar a UAZAPI em vez da Z-API.

- **Z-API (admin)**: `https://api.z-api.io/instances/{id}/token/{token}/send-text` com header `Client-Token`
- **UAZAPI (funcionários)**: `{server_url}/sendText/{instance_token}` com body `{ phone, message }`

Lógica:
```
if (uazapi_server_url && uazapi_instance_token) {
  // Usar UAZAPI
  url = `${uazapi_server_url}/sendText/${uazapi_instance_token}`
  body = { phone, message }
} else {
  // Usar Z-API (comportamento atual)
}
```

### 3. Alterar `src/pages/Acionamento.tsx`

#### Nova aba "Configuração"
- Adicionar um terceiro botão de aba: "CONFIGURAÇÃO"
- Formulário com campos:
  - **Server URL** (input text) — ex: `https://certificadoracnpj.uazapi.com`
  - **Instance Token** (input text) — ex: `c01095d6-64d4-4b33-9c1f-86a09948dc7c`
- Botão "Salvar configuração" que persiste no banco (`user_whatsapp_config`)
- Mostrar status "Configurado" ou "Não configurado" com badge

#### Lógica de envio
- Importar `useAuth` para obter o user ID
- Importar `useUserRole` para detectar admin
- Ao montar a página, buscar config do usuário em `user_whatsapp_config`
- No `handleSend`:
  - Se o usuário for admin (sem config UAZAPI), enviar sem parâmetros extras (usa Z-API)
  - Se o usuário tiver config UAZAPI, passar `uazapi_server_url` e `uazapi_instance_token` no body da chamada

### 4. Detalhes técnicos

- O `activeTab` muda de `'pendentes' | 'enviados'` para `'pendentes' | 'enviados' | 'config'`
- A aba "Configuração" aparece para todos os usuários, mas admins verão uma mensagem indicando que usam a API padrão do sistema
- As credenciais UAZAPI são armazenadas no banco (não no localStorage) para segurança
- A edge function mantém retrocompatibilidade total — sem parâmetros UAZAPI, usa Z-API

