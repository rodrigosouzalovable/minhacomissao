

## Corrigir recebimento de mensagens no Inbox — Webhooks não configurados

### Diagnóstico
A instância **MEMU 98 (62981034702)** não tem webhook configurado na UAZAPI — nenhum log de webhook foi recebido para esta instância. O cliente respondeu "Sim" mas a UAZAPI não enviou essa mensagem para o sistema.

Isso afeta **~20 instâncias** que não receberam nenhuma mensagem de entrada nas últimas 24h, incluindo várias instâncias MEMU e outras criadas recentemente (12/04, 11/04, etc.).

**Causa raiz**: O webhook só é configurado automaticamente no momento da conexão via QR. Se o webhook foi resetado na UAZAPI ou falhou silenciosamente, nunca mais é reconfigurado.

### Correções

#### 1. Adicionar botão "Reconfigurar Webhooks" em Acionamento
- Na seção "Configurações WhatsApp", adicionar um botão que percorre TODAS as instâncias ativas e reconfigura o webhook via a mesma lógica de `setupWebhook` do `whatsapp-qr`
- Mostrar progresso e resultado (quantas configuradas com sucesso vs. falhas)

#### 2. Nova action `setup-webhook-all` no `whatsapp-qr`
- Aceita `action: "setup-webhook-all"` 
- Percorre todas as instâncias ativas do banco
- Para cada uma, tenta configurar o webhook usando a estratégia de 3 tentativas (endpoint com token, sem token, globalwebhook)
- Retorna resumo: `{ total, success, failed, details[] }`

#### 3. Auto-reconfigurar webhook no check de conexão
- Na action `status` do `whatsapp-qr`, quando detecta que a instância está conectada, também reconfigura o webhook automaticamente (fire-and-forget)
- Isso garante que toda vez que o sistema verifica o status de uma instância, o webhook é reforçado

### Arquivos
1. **`supabase/functions/whatsapp-qr/index.ts`** — nova action `setup-webhook-all` + auto-reconfig no `status`
2. **`src/pages/Acionamento.tsx`** — botão "Reconfigurar Webhooks" na seção de configurações

### Resultado
Todas as instâncias terão webhooks configurados corretamente. Mensagens de clientes passarão a aparecer no Inbox imediatamente.

