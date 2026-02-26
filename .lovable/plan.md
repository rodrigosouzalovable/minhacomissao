

# Rotação de Múltiplos WhatsApps (UAZAPI) no Acionamento

## Visão Geral

Sim, é totalmente possível. A ideia é permitir cadastrar múltiplas instâncias UAZAPI e rotacionar os envios entre elas (round-robin: X → Y → Z → X → Y → Z...).

## Alterações Necessárias

### 1. Banco de dados: nova tabela `user_whatsapp_instances`

A tabela atual `user_whatsapp_config` armazena apenas 1 config por usuário. Criaremos uma nova tabela para múltiplas instâncias:

- `id` (uuid, PK)
- `user_id` (uuid, NOT NULL)
- `nome` (text) — nome identificador (ex: "WhatsApp X")
- `server_url` (text, NOT NULL)
- `instance_token` (text, NOT NULL)
- `ativo` (boolean, default true)
- `criado_em` (timestamptz)

RLS: usuário só gerencia suas próprias instâncias.

### 2. `src/pages/Acionamento.tsx` — UI de configuração

Substituir o formulário de config única por uma lista de instâncias com:
- Botão "Adicionar WhatsApp" para cadastrar nova instância (nome, URL, token)
- Lista das instâncias cadastradas com botões editar/remover/testar
- Badge mostrando quantas instâncias ativas

### 3. `src/hooks/useAutoSend.tsx` — Rotação round-robin

Alterar `startAutoSend` para receber um array de configs em vez de uma única:

```typescript
uazapiConfigs: { server_url: string; instance_token: string; nome: string }[]
```

No loop de envio, usar um contador sequencial para rotacionar:

```text
Envio 1 → config[0] (WhatsApp X)
Envio 2 → config[1] (WhatsApp Y)
Envio 3 → config[2] (WhatsApp Z)
Envio 4 → config[0] (WhatsApp X)  // volta ao início
...
```

A função `sendSingle` receberá a config específica de cada envio via `configIndex % configs.length`.

### 4. `src/pages/Acionamento.tsx` — Passagem dos dados

Ao clicar "Iniciar", buscar todas as instâncias ativas do usuário e passar o array para `startAutoSend`.

### Resumo de arquivos
- **1 migração**: criar tabela `user_whatsapp_instances`
- **1 alterado**: `src/hooks/useAutoSend.tsx` — suporte a array de configs + round-robin
- **1 alterado**: `src/pages/Acionamento.tsx` — UI para gerenciar múltiplas instâncias

