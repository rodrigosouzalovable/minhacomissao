

## Plano: Automação do webhook só no momento da conexão (sem cron)

### Decisão
Removido o cron de 30/30 min. A configuração do webhook acontece **apenas quando o WhatsApp é conectado** — zero custo recorrente no Lovable Cloud.

### O que será feito

**1. Reforçar `reinforceWebhook` em `whatsapp-qr/index.ts`**
- 3 tentativas com backoff (1s, 3s, 6s) — cobre lentidão pontual da UAZAPI
- Após o POST, fazer `GET /webhook` para confirmar que a URL salva é a esperada e o evento `messages` está ativo
- Se confirmou, gravar `webhook_configurado_em = now()` em `user_whatsapp_instances`
- Payload simplificado recomendado pelo suporte UAZAPI:
  ```json
  { "url": "<chatbot>", "events": ["messages"],
    "excludeMessages": ["wasSentByApi","isGroupYes"] }
  ```

**2. Disparar a configuração nos 2 momentos certos**
- Já existe: ao detectar `connected: true` no `checkStatus` (mantido)
- Adicionar: imediatamente após `createInstance` retornar OK (antes mesmo de escanear o QR já fica pré-configurado)

**3. Botão manual continua existindo como rede de segurança**
"Diagnosticar Webhooks" + "Reparar X Webhook(s)" no Monitor de Envios → você usa só se desconfiar de algo. Sem automação rodando em background.

### Custo Lovable Cloud
**Zero adicional.** Sem cron, sem invocações recorrentes. Só roda quando você conecta um WhatsApp novo (ato manual seu).

### Memórias respeitadas
- ✅ `cloud-cost-awareness`: nenhuma execução recorrente nova
- ✅ `never-load-group-messages`: filtro `isGroupYes` mantido na origem

### Arquivos afetados
- `supabase/functions/whatsapp-qr/index.ts` — `reinforceWebhook` com retry + verify; chamar também após `createInstance`
- Migração: adicionar coluna `webhook_configurado_em timestamptz` em `user_whatsapp_instances`

### Fora de escopo
- ❌ Cron job (descartado por custo)
- ❌ Nova edge function `auto-repair-webhooks` (descartada)
- ❌ Mexer no fluxo de envio, autosave, aquecimento, inbox

