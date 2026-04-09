

## Diagnóstico Final Confirmado

### O que realmente está acontecendo

1. **O teste manual envia as mensagens com sucesso** — confirmado nos registros `whatsapp_aquecimento_interacoes` (status ENVIADO)
2. **O webhook do `whatsapp-chatbot` NUNCA é chamado para essas instâncias** — zero logs com tokens `33fb5e46` ou `cef8686a`, zero logs com `556282115479` ou `556282197615`
3. **Outras instâncias recebem webhooks normalmente** — logs mostram `[AQUECIMENTO] Verificando` e `[INBOX] Mensagem entrada salva` para outras instâncias

### Causa raiz: `wasSentByApi` no filtro de exclusão do webhook

Em `whatsapp-qr/index.ts` linha 293, o webhook é configurado com:
```
excludeMessages: ["wasSentByApi"]
```

Quando a Instância A envia uma mensagem para a Instância B **via API** (que é exatamente o que o aquecimento faz), o UAZAPI pode estar marcando essa mensagem como `wasSentByApi` **também no lado receptor** (Instância B), já que o envio foi feito programaticamente. Com o filtro de exclusão ativo, o webhook simplesmente não dispara, e o chatbot nunca é notificado.

Isso explica por que:
- As mensagens chegam (o WhatsApp entrega normalmente)
- Mas o webhook não é acionado (filtrado pelo UAZAPI antes de chamar a URL)
- O bloco de aquecimento/IA nunca executa

### Plano de Correção

**1. Remover `wasSentByApi` do filtro de exclusão do webhook** (`whatsapp-qr/index.ts`)

Alterar a configuração do webhook para não excluir `wasSentByApi`. Para evitar loops, a proteção contra loops já existe no código do chatbot (verifica `isFromMe` e ignora mensagens enviadas pela própria instância).

**2. Reconfigurar webhooks das instâncias de teste** (`whatsapp-aquecimento/index.ts`)

Adicionar no handler `manual-test` uma chamada para reconfigurar o webhook de cada instância selecionada, removendo o filtro `wasSentByApi`. Isso garante que as instâncias existentes (que foram configuradas com o filtro antigo) passem a funcionar sem precisar reconectar manualmente.

**3. Migrar a IA de Ollama/Gemma para Lovable AI (Gemini)** (`whatsapp-ia-responder/index.ts`)

Substituir a chamada ao `OLLAMA_NGROK_URL` (que depende de servidor local + ngrok) por uma chamada ao Lovable AI Gateway usando `google/gemini-2.5-flash`. Isso garante disponibilidade sem dependência local.

### Arquivos a modificar

- `supabase/functions/whatsapp-qr/index.ts` — remover `wasSentByApi` da exclusão
- `supabase/functions/whatsapp-aquecimento/index.ts` — reconfigurar webhook automaticamente no teste manual
- `supabase/functions/whatsapp-ia-responder/index.ts` — migrar de Ollama para Lovable AI Gateway

### Proteção contra loops

O risco de remover `wasSentByApi` (loop infinito de bot respondendo para si mesmo) já é mitigado por:
- `isFromMe` check que ignora mensagens enviadas pela própria instância
- Lógica de aquecimento que só responde se existir uma interação pendente recente
- Limite de trocas (5-7) + cooldown de 4 horas entre conversas

