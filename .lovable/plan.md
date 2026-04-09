

## Diagnóstico: Por que a IA não está respondendo

Encontrei **2 problemas críticos** no fluxo atual:

### Problema 1: Busca de instância interna falha (phone mismatch)

O `inboxTelefone` extraído do webhook tem prefixo `55` (ex: `5562982115479`), mas o campo `nome` da instância armazena sem o `55` (ex: `62982115479 MEMU 37 03/04`). A query `nome.ilike.%5562982115479%` **nunca encontra** a instância, então o bloco de aquecimento inteiro é ignorado silenciosamente.

**Correção**: Tentar match também com o telefone sem o prefixo `55`:
```typescript
const phoneSuffix = inboxTelefone.startsWith('55') ? inboxTelefone.slice(2) : inboxTelefone;
const { data: senderInstance } = await supabase
  .from('user_whatsapp_instances')
  .select('id')
  .or(`nome.ilike.%${inboxTelefone}%,nome.ilike.%${phoneSuffix}%`)
  .eq('ativo', true)
  .limit(1)
  .maybeSingle();
```

### Problema 2: `setTimeout` não funciona em Edge Functions

O código usa `setTimeout` com delay de 15-90s para simular leitura humana, mas Edge Functions encerram o processo assim que retornam a Response (linha 1395). O callback do `setTimeout` **nunca executa**.

**Correção**: Em vez de `setTimeout`, chamar a edge function `whatsapp-ia-responder` passando o delay desejado, e mover o delay para dentro da `whatsapp-ia-responder` (que aguarda antes de gerar e enviar a resposta). Ou, mais simples: durante o teste manual, usar delay zero e chamar diretamente sem `setTimeout` (aguardar inline com `await`). Para produção, a `whatsapp-ia-responder` deve receber os dados da instância e fazer o envio ela mesma após o delay.

### Plano de implementação

**Arquivo: `supabase/functions/whatsapp-chatbot/index.ts`**
- Corrigir a busca de `senderInstance` para tentar match com e sem prefixo `55`
- Remover o `setTimeout` e em vez disso enviar o delay desejado como parâmetro para `whatsapp-ia-responder`
- Passar `server_url`, `instance_token` e `numero_destino` no payload da IA para que ela faça o envio

**Arquivo: `supabase/functions/whatsapp-ia-responder/index.ts`**
- Receber parâmetros extras: `delay_ms`, `server_url`, `instance_token`, `numero_destino`
- Aguardar `delay_ms` com `await new Promise(r => setTimeout(r, delay_ms))` (funciona dentro da mesma request)
- Após gerar a resposta da IA, enviar a mensagem via UAZAPI diretamente
- Retornar o resultado

Isso resolve ambos os problemas: a instância interna será encontrada corretamente e o delay será executado dentro da function que está processando a request (não em fire-and-forget).

### Arquivos alterados
- `supabase/functions/whatsapp-chatbot/index.ts`
- `supabase/functions/whatsapp-ia-responder/index.ts`

