

## Diagnóstico Final — Por que os números não se comunicam

### Problema Confirmado

Os logs mostram que:

1. As mensagens de aquecimento são enviadas com sucesso (status `ENVIADO` no banco)
2. **O webhook do `whatsapp-chatbot` NUNCA recebe chamadas dessas duas instâncias** — zero logs com `82197615` ou `82115479`
3. Outras instâncias recebem webhooks normalmente
4. A tentativa de reconfigurar o webhook no teste manual **retornou 405** (endpoint errado)

### Causa Raiz

Existem **dois problemas simultâneos**:

**Problema 1: O webhook dessas instâncias no UAZAPI ainda tem o filtro `excludeMessages: ["wasSentByApi"]`**

Esse filtro foi configurado quando as instâncias foram conectadas pela primeira vez (via `whatsapp-qr`). O código foi alterado para remover esse filtro em **novas** configurações, mas as instâncias existentes **ainda têm o filtro antigo ativo no UAZAPI**. Como as mensagens de aquecimento são enviadas via API, o UAZAPI as filtra e nunca chama o webhook.

**Problema 2: A reconfiguração automática no teste manual falha (405)**

O código de `whatsapp-aquecimento` tenta reconfigurar o webhook usando apenas 1 endpoint (`/webhook/{token}`), mas o UAZAPI retorna 405. O `whatsapp-qr` já tem lógica de **3 fallbacks** que funciona — mas essa lógica não foi replicada no aquecimento.

### Plano de Correção

**1. Corrigir a reconfiguração de webhook no `whatsapp-aquecimento`**

Replicar a mesma lógica de 3 fallback endpoints que o `whatsapp-qr` usa:
- `{base}/webhook/{token}` (POST)
- `{base}/webhook` (POST com header `token`)
- `{base}/globalwebhook` (POST com header `admintoken`)

O payload deve explicitamente incluir `excludeMessages: []` para forçar a remoção do filtro.

**2. Adicionar ação dedicada `reconfigurar-webhooks` no `whatsapp-aquecimento`**

Criar uma ação separada que permite reconfigurar os webhooks de instâncias específicas sem precisar enviar mensagens de teste. Isso permite corrigir instâncias existentes.

**3. No teste manual, aguardar confirmação de reconfiguração antes de enviar**

Atualmente, o teste manual envia mesmo se a reconfiguração falhar. Adicionar um log de aviso e garantir que pelo menos um dos endpoints retorne sucesso.

### Arquivos a modificar

- `supabase/functions/whatsapp-aquecimento/index.ts` — corrigir reconfiguração com 3 fallbacks + `excludeMessages: []`

### Resultado esperado

Após o deploy, ao executar o teste manual novamente:
1. O webhook será reconfigurado com sucesso (removendo o filtro `wasSentByApi`)
2. As mensagens enviadas por API entre instâncias passarão a disparar o webhook
3. O `whatsapp-chatbot` detectará a instância interna e acionará o `whatsapp-ia-responder`
4. A IA (Lovable AI / Gemini) gerará e enviará a resposta

